import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from models import (
    OptimizeRequest, CompareRequest, ChatRequest,
    ComparisonResult, ScenarioSummary, SummarizeRequest,
    Movement, MovementsResponse,
)
from data import get_distribution_centers, get_lanes, get_scenarios, get_scenario
from optimizer import solve_redeployment, solve_intuitive
from explainer import explain_decision, call_llm

load_dotenv()

app = FastAPI(title="Inventory Redeployment Optimizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "https://supply-iq-sand.vercel.app", "https://supply-iq-persistent.vercel.app", "https://supplymind-iq.vercel.app", "https://supply-iq-cogniify.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/network")
def get_network():
    return {
        "dcs": [dc.model_dump() for dc in get_distribution_centers()],
        "lanes": [lane.model_dump() for lane in get_lanes()],
    }


@app.get("/api/scenarios")
def list_scenarios():
    return [
        ScenarioSummary(
            id=s.id, name=s.name, description=s.description, icon=s.icon
        ).model_dump()
        for s in get_scenarios()
    ]


@app.get("/api/scenarios/{scenario_id}")
def get_scenario_detail(scenario_id: str):
    scenario = get_scenario(scenario_id)
    if not scenario:
        return {"error": "Scenario not found"}, 404
    return scenario.model_dump()


PARETO_STRATEGIES = [
    {
        "name": "Cash King",
        "description": "Maximize cost savings. Ships via cheapest routes (often slow rail). Accepts higher stockout risk.",
        "weights": {"cost": 0.80, "carbon": 0.10, "service_risk": 0.10},
    },
    {
        "name": "Green Choice",
        "description": "Minimize carbon footprint. Avoids air/truck, favors rail & intermodal. May cost more.",
        "weights": {"cost": 0.10, "carbon": 0.80, "service_risk": 0.10},
    },
    {
        "name": "Service First",
        "description": "Maximize availability. Pre-stocks high-risk DCs, overships safety buffers. Highest total cost.",
        "weights": {"cost": 0.10, "carbon": 0.10, "service_risk": 0.80},
    },
    {
        "name": "Balanced",
        "description": "Equal weighting across all three objectives. Compromise solution.",
        "weights": {"cost": 0.33, "carbon": 0.33, "service_risk": 0.34},
    },
]


@app.post("/api/pareto")
def pareto(req: OptimizeRequest):
    if req.scenario_id:
        scenario = get_scenario(req.scenario_id)
        if not scenario:
            return {"error": "Scenario not found"}
        dcs = scenario.dcs
        lanes = scenario.lanes
    else:
        dcs = get_distribution_centers()
        lanes = get_lanes()

    results = []
    for strategy in PARETO_STRATEGIES:
        result = solve_redeployment(dcs, lanes, strategy["weights"], req.budget_ceiling)
        results.append({
            "strategy_name": strategy["name"],
            "strategy_description": strategy["description"],
            "weights": strategy["weights"],
            "result": result.model_dump(),
        })

    return results


@app.post("/api/movements")
def get_movements(req: OptimizeRequest):
    if req.scenario_id:
        scenario = get_scenario(req.scenario_id)
        if not scenario:
            return {"error": "Scenario not found"}
        dcs = scenario.dcs
        lanes = scenario.lanes
    else:
        dcs = get_distribution_centers()
        lanes = get_lanes()

    result = solve_redeployment(dcs, lanes, req.weights, req.budget_ceiling)

    lane_map = {(l.origin, l.destination): l for l in lanes}
    dc_util = {ds.id: ds.utilization_pct for ds in result.dc_states_after}

    total_cost = sum(t.cost for t in result.transfers)
    total_units = sum(t.units for t in result.transfers)
    total_carbon = sum(t.carbon_kg for t in result.transfers)
    avg_cpu = total_cost / total_units if total_units > 0 else 0

    # Find shortest lane to each destination for anomaly detection
    shortest_to_dest = {}
    for lane in lanes:
        if lane.destination not in shortest_to_dest or lane.distance_miles < shortest_to_dest[lane.destination]:
            shortest_to_dest[lane.destination] = lane.distance_miles

    movements = []
    anomaly_count = 0
    for i, t in enumerate(result.transfers):
        lane = lane_map.get((t.origin, t.destination))
        mode = lane.mode if lane else "truck"
        cpu = t.cost / t.units if t.units > 0 else 0
        carbon_pu = t.carbon_kg / t.units if t.units > 0 else 0

        is_anomaly = False
        if dc_util.get(t.destination, 0) > 85:
            is_anomaly = True
        if total_units > 0 and cpu > avg_cpu * 1.5:
            is_anomaly = True
        if lane and shortest_to_dest.get(t.destination):
            if lane.distance_miles > shortest_to_dest[t.destination] * 1.5:
                is_anomaly = True

        if is_anomaly:
            anomaly_count += 1

        movements.append(Movement(
            index=i + 1,
            origin=t.origin,
            destination=t.destination,
            mode=mode,
            units=t.units,
            cost=round(t.cost, 2),
            cost_per_unit=round(cpu, 2),
            carbon_kg=round(t.carbon_kg, 2),
            carbon_per_unit=round(carbon_pu, 2),
            flag="Anomaly" if is_anomaly else "Standard",
        ))

    summary = {
        "total_cost": round(total_cost, 2),
        "total_carbon_kg": round(total_carbon, 2),
        "total_carbon_tonnes": round(total_carbon / 1000, 1),
        "total_units": total_units,
        "anomaly_count": anomaly_count,
        "avg_cost_per_unit": round(avg_cpu, 2),
        "avg_carbon_per_unit_kg": round(total_carbon / total_units, 1) if total_units else 0,
    }

    return MovementsResponse(movements=movements, summary=summary).model_dump()


@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    if req.scenario_id:
        scenario = get_scenario(req.scenario_id)
        if not scenario:
            return {"error": "Scenario not found"}
        dcs = scenario.dcs
        lanes = scenario.lanes
    else:
        dcs = get_distribution_centers()
        lanes = get_lanes()

    result = solve_redeployment(dcs, lanes, req.weights, req.budget_ceiling)
    return result.model_dump()


@app.post("/api/optimize/compare")
def compare(req: CompareRequest):
    scenario = get_scenario(req.scenario_id)
    if not scenario:
        return {"error": "Scenario not found"}

    intuitive = solve_intuitive(scenario)
    optimized = solve_redeployment(
        scenario.dcs, scenario.lanes, req.weights, req.budget_ceiling
    )

    savings = {
        "cost": round(intuitive.objective_value - optimized.objective_value, 2),
        "transport": round(
            intuitive.cost_breakdown.transport - optimized.cost_breakdown.transport, 2
        ),
        "stockout_penalty": round(
            intuitive.cost_breakdown.stockout_penalty
            - optimized.cost_breakdown.stockout_penalty, 2
        ),
        "carbon_kg": round(
            intuitive.total_carbon_kg - optimized.total_carbon_kg, 2
        ),
    }

    return ComparisonResult(
        intuitive=intuitive,
        optimized=optimized,
        savings=savings,
    ).model_dump()


@app.post("/api/chat")
async def chat(req: ChatRequest):
    scenario = get_scenario(req.scenario_id) if req.scenario_id else None

    # Auto-run optimizer to give the LLM exact numbers
    opt_result = req.optimization_result
    if not opt_result and scenario:
        result = solve_redeployment(
            scenario.dcs, scenario.lanes,
            {"cost": 0.5, "carbon": 0.3, "service_risk": 0.2},
        )
        opt_result = result.model_dump()

    async def generate():
        try:
            response = await explain_decision(
                scenario=scenario,
                optimization_result=opt_result,
                user_question=req.message,
                conversation_history=req.conversation_history,
                summary=req.summary,
                recent_messages=req.recent_messages if req.recent_messages else None,
            )
            # Send as SSE
            yield f"data: {json.dumps({'type': 'response', 'content': response})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/api/chat/summarize")
async def summarize_chat(req: SummarizeRequest):
    if not req.messages:
        return {"summary": ""}

    # Build a conversation transcript for summarization
    transcript = "\n".join(
        f"{m.get('role', 'user').upper()}: {m.get('content', '')}"
        for m in req.messages[-6:]  # last 6 messages max for summarization
    )

    prompt = (
        f"Summarize this supply chain conversation in 1-2 concise sentences. "
        f"Focus on what was discussed and any key decisions or insights:\n\n{transcript}"
    )

    summary = await call_llm(prompt)

    # Fallback: use last exchange
    if not summary:
        last_user = ""
        last_assistant = ""
        for m in reversed(req.messages):
            if m.get("role") == "assistant" and not last_assistant:
                last_assistant = m.get("content", "")[:100]
            elif m.get("role") == "user" and not last_user:
                last_user = m.get("content", "")[:80]
            if last_user and last_assistant:
                break
        summary = f"Discussed: {last_user}. Key point: {last_assistant}"

    return {"summary": summary}


@app.post("/api/pipeline")
async def pipeline(req: OptimizeRequest):
    from agents.orchestrator import run_pipeline

    async def stream():
        async for event in run_pipeline(req.scenario_id, req.weights, req.budget_ceiling):
            yield event

    return StreamingResponse(stream(), media_type="text/event-stream")


GLOSSARY = [
    {"term": "Objective Function (Z)", "category": "Core", "definition": "The weighted cost function the optimizer minimizes: Z = w₁·(Transport + Holding + Overflow) + w₂·(Carbon) + w₃·(Stockout Penalty). Lower Z means a better solution.", "formula": "Z = w₁·Cost + w₂·CO₂ + w₃·Risk"},
    {"term": "Strategic Weights", "category": "Core", "definition": "Three user-adjustable weights (Cost, Carbon, Service Risk) that control the optimizer's priorities. They always sum to 1.0. Default: Cost=0.5, Carbon=0.3, Service Risk=0.2.", "formula": "w₁ + w₂ + w₃ = 1.0"},
    {"term": "Shadow Price", "category": "Core", "definition": "The marginal cost of relaxing a constraint by one unit. A high shadow price on a capacity constraint means adding one more unit of capacity at that DC would significantly reduce total cost."},
    {"term": "Transport Cost", "category": "Costs", "definition": "Cost of moving inventory between DCs. Ranges from $2.30/unit (DFW→ATL, 780 mi) to $6.90/unit (NYC→SEA, 2,850 mi). Calculated as transport_cost_per_unit × units shipped.", "formula": "∑(Tᵢⱼ · Xᵢⱼ)"},
    {"term": "Holding Cost", "category": "Costs", "definition": "Cost of storing inventory at the destination DC after transfer. Ranges from $1.10/unit (Dallas) to $2.00/unit (New York). Applied to all units received.", "formula": "∑(Hⱼ · Xᵢⱼ)"},
    {"term": "Stockout Penalty", "category": "Costs", "definition": "Penalty applied when demand cannot be met at a DC. Fixed at $100 per unit of unmet demand. This drives the optimizer to prioritize fulfillment at high-demand DCs.", "formula": "$100 × unmet_demand"},
    {"term": "Overflow Penalty", "category": "Costs", "definition": "Penalty for exceeding a DC's nominal capacity. Fixed at $3 per unit above capacity. The optimizer allows up to 15% overflow before hitting the hard constraint.", "formula": "$3 × excess_units"},
    {"term": "Overflow Allowance", "category": "Costs", "definition": "DCs can temporarily exceed nominal capacity by up to 15%. Stock above 100% incurs the overflow penalty ($3/unit), but stock above 115% is not allowed.", "formula": "max_stock ≤ capacity × 1.15"},
    {"term": "Distribution Center (DC)", "category": "Network", "definition": "A warehouse node in the network. The system has 6 DCs: Atlanta (10K cap), Chicago (10K), Los Angeles (12K), Seattle (8K), Dallas (9K), New York (11K). Each has current stock, demand forecast, and holding cost."},
    {"term": "Lane", "category": "Network", "definition": "A directional shipping route between two DCs. The network has 30 lanes with varying distances (720-2,850 mi), costs ($2.30-$6.90/unit), carbon emissions (12-46 kg/unit), transit times (2-5 days), and transport modes (truck/rail/intermodal)."},
    {"term": "Safety Stock", "category": "Network", "definition": "Minimum inventory buffer at each DC to protect against demand variability. Ranges from 400 units (Seattle) to 800 units (Chicago). Net available supply = current_stock - safety_stock."},
    {"term": "The Early Bird", "category": "Scenarios", "definition": "Counter-intuitive scenario: Ship 2,000 units from Atlanta to Chicago before demand exists because freight rates will spike 4x (from $2.50 to $10.00/unit) in 2 days due to a regional labor strike. Shipping early saves $13,200."},
    {"term": "The Long Haul", "category": "Scenarios", "definition": "Counter-intuitive scenario: Ship from Dallas (2,150 mi) instead of nearby Los Angeles (1,140 mi) to Seattle because LAX stock is reserved for a Tier-1 customer. The extra $4,200 in freight avoids $50,000 in lost revenue."},
    {"term": "The Overstock", "category": "Scenarios", "definition": "Counter-intuitive scenario: Push Chicago to 105% capacity ahead of a regional promotion (+4,000 demand). Overflow storage costs $7,500 but avoids $45,000 in lost sales during the promo."},
    {"term": "Stockout Risk Levels", "category": "Risk", "definition": "DCs are scored by supply/demand ratio: CRITICAL (<0.5, 85-95% stockout probability), HIGH (0.5-0.8, 40-60%), MEDIUM (0.8-1.0, 15-40%), LOW (>1.0, 2-15%)."},
    {"term": "Days of Supply", "category": "Risk", "definition": "How many days a DC's current inventory can sustain demand without resupply. Calculated as net_available / (demand_forecast / 30). Below 7 days is critical.", "formula": "net_available / daily_demand"},
    {"term": "CO₂ Footprint", "category": "Sustainability", "definition": "Carbon emissions from transporting inventory. Ranges from 12 kg/unit (ATL↔CHI truck, 720 mi) to 46 kg/unit (NYC→SEA intermodal, 2,850 mi). Weighted by w₂ in the objective function.", "formula": "∑(Eᵢⱼ · Xᵢⱼ)"},
    {"term": "Transport Mode", "category": "Sustainability", "definition": "Three modes available: Truck (<1,000 mi, fast but high CO₂), Rail (1,000-1,500 mi, low CO₂ but slower), Intermodal (>1,500 mi, balanced cost/carbon for long haul)."},
    {"term": "Capacity Utilization", "category": "Metrics", "definition": "Percentage of a DC's capacity currently in use: (current_stock / capacity) × 100. Above 85% triggers anomaly flags in the Movement Ledger. Above 100% incurs overflow penalties.", "formula": "(stock / capacity) × 100%"},
    {"term": "Pareto Frontier", "category": "Metrics", "definition": "A comparison table showing optimization results under 4 preset weight strategies: Cash King (80/10/10), Green Choice (10/80/10), Service First (10/10/80), Balanced (33/33/34). Demonstrates that no single solution dominates all objectives."},
    {"term": "Anomaly Detection", "category": "Metrics", "definition": "Transfers flagged as anomalies in the Movement Ledger when: destination DC utilization exceeds 85%, cost/unit is >1.5× the average, or lane distance is >1.5× the shortest available route to that destination."},
]


@app.get("/api/glossary")
def get_glossary():
    return GLOSSARY


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
