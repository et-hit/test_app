from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from cassandra.cluster import Cluster
from cassandra.query import dict_factory, SimpleStatement
from typing import List, Optional
from cassandra.policies import DCAwareRoundRobinPolicy, TokenAwarePolicy, WhiteListRoundRobinPolicy
from cassandra.query import BatchStatement, BatchType
from fastapi import Query
from fastapi.responses import JSONResponse
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel
from cassandra import ConsistencyLevel, WriteTimeout
from cassandra.util import Date as CassandraDate
import uuid
import xml.etree.ElementTree as ET
import time
import random
import datetime
import json
import traceback
import threading
import queue





alert_queue = queue.Queue()


def alert_worker():
    BATCH_LIMIT = 20
    MAX_RETRIES = 3

    while True:
        batch_data = []

        try:
            batch_data.append(alert_queue.get(timeout=1))
        except queue.Empty:
            continue

        while len(batch_data) < BATCH_LIMIT:
            try:
                batch_data.append(alert_queue.get_nowait())
            except queue.Empty:
                break

        batch = BatchStatement(
            batch_type=BatchType.UNLOGGED,
            consistency_level=ConsistencyLevel.ONE
        )

        for alert_fields, insert_time in batch_data:
            try:
                batch.add(prepared_alert_id_query, (
                    alert_fields["alert_id"], alert_fields["region"], alert_fields["tenant"],
                    alert_fields["score"], alert_fields["account_number"], alert_fields["alert_date"],
                    alert_fields["alert_description"], alert_fields["alert_type"], alert_fields["amount"],
                    insert_time, alert_fields["first_name"], alert_fields["last_name"], False,
                    alert_fields["severity"], "new", alert_fields["transaction_key"], insert_time
                ))

                batch.add(prepared_alert_status_query, (
                    "new", alert_fields["alert_date"], insert_time, alert_fields["alert_id"],
                    alert_fields["region"], alert_fields["tenant"], alert_fields["score"],
                    alert_fields["account_number"], alert_fields["alert_description"],
                    alert_fields["alert_type"], alert_fields["amount"], alert_fields["first_name"],
                    alert_fields["last_name"], False, alert_fields["severity"],
                    alert_fields["transaction_key"], insert_time
                ))

            except Exception as e:
                print(f"❌ Skipped bad alert: {e}")
                continue

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                session.execute(batch)
                print(f"✅ Inserted {len(batch_data)} alerts")
                break
            except WriteTimeout:
                print(f"⚠️ Retry {attempt}/{MAX_RETRIES} on batch of {len(batch_data)} alerts")
                time.sleep(0.2 * attempt)
            except Exception as e:
                print(f"❌ Batch insert failed: {e}")
                break


# Launch worker at startup
threading.Thread(target=alert_worker, daemon=True).start()




app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    #allow_origins=["*"],  # Adjust in production
    #allow_origins=["192.168.1.103"],
    allow_origins=["192.168.1.103, https://halibut-more-tiger.ngrok-free.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cluster = Cluster(
    #contact_points=['192.168.1.103', '192.168.1.120'],
    #contact_points=['192.168.1.120'],
    contact_points=['192.168.1.103'],
    load_balancing_policy=TokenAwarePolicy(
        DCAwareRoundRobinPolicy(local_dc='datacenter1')
    ),
    #load_balancing_policy=WhiteListRoundRobinPolicy(['192.168.1.103']),
    connect_timeout=5.0,
    idle_heartbeat_interval=30,
)

#session = cluster.connect('eventlog')
session = cluster.connect()
session.default_consistency_level = ConsistencyLevel.ONE
session.row_factory = dict_factory

class StatusUpdateRequest(BaseModel):
    status: str

#prepared_alert_query = session.prepare("""
#    INSERT INTO alerts.alerts_by_date (
#        alert_date, status, create_timestamp, alert_id, transaction_key,
#        alert_type, alert_description, amount,
#        first_name, last_name, account_number,
#        transaction_timestamp, severity, reviewed
#    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
#""")

prepared_transaction_query = session.prepare("""
    INSERT INTO alerts.transactions (
        insert_date,
        insert_time,
        transaction_key,
        session_id,
        first_name,
        last_name,
        account_number,
        amount,

        field_1,
        field_2,
        field_3,
        field_4,
        field_5,
        field_6,
        field_7,
        field_8,
        field_9,
        field_10,
        field_11,
        field_12,
        field_13,
        field_14,
        field_15,
        field_16,
        field_17,
        field_18,
        field_19,
        field_20
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
""")

prepared_alert_status_query = session.prepare("""
    INSERT INTO alerts.alerts_by_status (
        status, alert_date, create_timestamp, alert_id, region,
        tenant, score, account_number, alert_description, alert_type,
        amount, first_name, last_name, reviewed, severity,
        transaction_key, transaction_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""")

prepared_alert_id_query = session.prepare("""
    INSERT INTO alerts.alerts_by_id (
        alert_id, region, tenant, score, account_number, alert_date,
        alert_description, alert_type, amount, create_timestamp,
        first_name, last_name, reviewed, severity, status,
        transaction_key, transaction_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""")

prepared_alerts_by_id_update = session.prepare("""
    UPDATE alerts.alerts_by_id
    SET reviewed = true, status = 'open'
    WHERE alert_id = ?
""")


# WebSocket connections
websocket_connections = set()

def compute_score_and_should_alert(amount: float):
    if amount > 49950:
        return 101, True
    elif amount > 49800:
        return 91, True
    elif amount > 49500:
        return 81, True
    elif amount > 49000:
        return 71, True
    elif amount > 47500:
        return 61, True
    elif amount > 45000:
        return 51, True
    else:
        return 50, False

def maybe_insert_alert(fields, insert_time):
    try:
        amount = float(fields["amount"])
        tenant = int(fields.get("tenant") or fields.get("field_5", 1))
        score = 0

        # Rule 1: based on amount thresholds
        base_score, rule1_triggered = compute_score_and_should_alert(amount)
        if rule1_triggered:
            score += base_score

        # Rule 2: based on fraud indicator
        field2 = fields.get("field_2", "")
        field2_triggered = field2 == "fraud"
        if field2_triggered:
            score += 90

        # No rules triggered, no alert
        if not rule1_triggered and not field2_triggered:
            return

        # Determine severity from final score
        if score > 85:
            severity = "CRITICAL"
        elif score > 70:
            severity = "HIGH"
        elif score > 60:
            severity = "ELEVATED"
        elif score > 50:
            severity = "MODERATE"
        else:
            return  # Below alert threshold

        alert_id = uuid.uuid4()
        alert_date = insert_time.date()

        # Determine alert type
        if rule1_triggered and field2_triggered:
            alert_type = "MULTIPLE"
        elif field2_triggered:
            alert_type = "FRAUD"
        else:
            alert_type = "HIGH_SCORE" if severity in ("HIGH", "CRITICAL") else "MEDIUM_SCORE"

        # Build description
        description_parts = []
        if rule1_triggered:
            description_parts.append("Rule1 triggered: amount threshold exceeded")
        if field2_triggered:
            description_parts.append(f"Rule2 triggered: field2 = {field2}")
        alert_description = ", ".join(description_parts)

        alert_fields = {
            "alert_id": alert_id,
            "region": fields.get("field_3"),
            "tenant": tenant,
            "score": score,
            "account_number": fields["account_number"],
            "alert_date": alert_date,
            "alert_description": alert_description,
            "alert_type": alert_type,
            "amount": amount,
            "first_name": fields["first_name"],
            "last_name": fields["last_name"],
            "severity": severity,
            "transaction_key": uuid.UUID(fields["transaction_key"])
        }

        alert_queue.put((alert_fields, insert_time))

    except Exception as e:
        print(f"❌ Failed to prepare alert for queue: {e}")


@app.post("/insert-transaction/")
async def insert_transaction(payload: dict):
    try:
        batch = payload.get("batch", [])
        if not batch:
            raise HTTPException(status_code=400, detail="Missing batch")

        FIELD_TYPES = {
            f"field_{i}": t for i, t in zip(range(1, 21), [
                "timestamp", "text", "text", "int", "bigint", "uuid", "date",
                "timestamp", "text", "text", "int", "bigint", "uuid", "date",
                "timestamp", "text", "text", "int", "bigint", "uuid"
            ])
        }

        field_order = [f"field_{i}" for i in range(1, 21)]
        batch_stmt = BatchStatement()

        for fields in batch:
            insert_date = fields["insert_date"]
            if isinstance(insert_date, str):
                insert_date = datetime.datetime.strptime(insert_date, "%Y-%m-%d").date()

            insert_time = fields["insert_time"]
            if isinstance(insert_time, str):
                try:
                    insert_time = datetime.datetime.strptime(insert_time, "%Y-%m-%dT%H:%M:%S.%f")
                except ValueError:
                    insert_time = datetime.datetime.strptime(insert_time, "%Y-%m-%dT%H:%M:%S")

            account_number = fields["account_number"]
            amount = float(fields["amount"])
            first_name = fields["first_name"]
            last_name = fields["last_name"]
            session_id = uuid.UUID(fields["session_id"]) if isinstance(fields["session_id"], str) else fields["session_id"]
            transaction_key = uuid.UUID(fields["transaction_key"]) if isinstance(fields["transaction_key"], str) else fields["transaction_key"]

            values = [
                insert_date, insert_time, transaction_key, session_id,
                first_name, last_name, account_number, amount
            ]

            for fname in field_order:
                val = fields.get(fname)
                if val is None:
                    values.append(None)
                    continue

                ftype = FIELD_TYPES[fname]
                try:
                    if ftype == "text":
                        values.append(str(val))
                    elif ftype == "int":
                        values.append(int(val))
                    elif ftype == "bigint":
                        values.append(int(val))
                    elif ftype == "uuid":
                        values.append(uuid.UUID(val) if isinstance(val, str) else val)
                    elif ftype == "date":
                        values.append(datetime.datetime.strptime(val, "%Y-%m-%d").date() if isinstance(val, str) else val)
                    elif ftype == "timestamp":
                        if isinstance(val, datetime.datetime):
                            values.append(val)
                        else:
                            try:
                                values.append(datetime.datetime.strptime(val, "%Y-%m-%dT%H:%M:%S.%f"))
                            except ValueError:
                                values.append(datetime.datetime.strptime(val, "%Y-%m-%dT%H:%M:%S"))
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Invalid value for {fname}: {val} ({e})")

            batch_stmt.add(prepared_transaction_query, values)
            # Inject backend-computed score + alert flag
            #score, should_alert = compute_score_and_should_alert(amount)
            #fields["score"] = score
            #fields["should_alert"] = should_alert
            
            score, should_alert = compute_score_and_should_alert(amount)
            fields["score"] = score
            fields["should_alert"] = should_alert
            maybe_insert_alert(fields, insert_time)

        session.execute(batch_stmt)
        return {"status": "success", "inserted_rows": len(batch)}

    except Exception as e:
        print("❌ Exception in /insert-transaction/:")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e) or "Unknown error occurred")

@app.post("/insert-event/")
async def insert_event(payload: dict):
    try:
        batch = payload.get("batch", [])
        if not batch:
            raise HTTPException(status_code=400, detail="Missing batch")

        UUID_FIELDS = {5, 12, 19, 26, 33, 40, 47, 54, 61, 68, 75, 82, 89, 96}
        DATE_FIELDS = {6, 13, 20, 27, 34, 41, 48, 55, 62, 69, 76, 83, 90, 97}
        TIMESTAMP_FIELDS = {7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91, 98}
        INT_FIELDS = {3, 10, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 94}
        BIGINT_FIELDS = {4, 11, 18, 25, 32, 39, 46, 53, 60, 67, 74, 81, 88, 95}

        prepared_query = session.prepare("""
            INSERT INTO eventlog.user_events_with_100_fields (
                user_id, event_date, event_time, event_type, metadata, session_id, xml_blob,
                """ + ', '.join([f'field_{i}' for i in range(1, 101)]) + """
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, """ + ', '.join(['?'] * 100) + """
            )
        """)

        chunk_size = 25  # small batches recommended for Cassandra
        for i in range(0, len(batch), chunk_size):
            chunk = batch[i:i + chunk_size]
            cass_batch = BatchStatement(consistency_level=ConsistencyLevel.ONE)

            for fields in chunk:
                user_id = uuid.UUID(fields.get("user_id"))
                event_date = fields.get("event_date")
                event_time = fields.get("event_time")
                if isinstance(event_time, str):
                    try:
                        event_time = datetime.datetime.strptime(event_time, "%Y-%m-%d %H:%M:%S.%f")
                    except ValueError:
                        event_time = datetime.datetime.strptime(event_time, "%Y-%m-%d %H:%M:%S")

                event_type = fields.get("event_type")
                metadata = fields.get("metadata")
                session_id = fields.get("session_id")
                xml_blob = fields.get("xml_blob").encode() if isinstance(fields.get("xml_blob"), str) else fields.get("xml_blob")

                dynamic_fields = []
                for i in range(1, 101):
                    val = fields.get(f"field_{i}")
                    if val is not None:
                        if i in UUID_FIELDS and isinstance(val, str):
                            val = uuid.UUID(val)
                        elif i in DATE_FIELDS and isinstance(val, str):
                            val = datetime.datetime.strptime(val, "%Y-%m-%d").date()
                        elif i in TIMESTAMP_FIELDS and isinstance(val, str):
                            try:
                                val = datetime.datetime.strptime(val, "%Y-%m-%d %H:%M:%S.%f")
                            except ValueError:
                                val = datetime.datetime.strptime(val, "%Y-%m-%d %H:%M:%S")
                        elif i in INT_FIELDS:
                            val = int(val)
                        elif i in BIGINT_FIELDS:
                            val = int(val)
                    dynamic_fields.append(val)

                values = [user_id, event_date, event_time, event_type, metadata, session_id, xml_blob] + dynamic_fields
                cass_batch.add(prepared_query, values)

            session.execute(cass_batch)

        return {"status": "success", "inserted_rows": len(batch)}

    except Exception as e:
        print("❌ Exception while inserting event batch:")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e) or "Unknown error occurred")

@app.websocket("/ws/data")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_connections.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_connections.remove(websocket)

async def broadcast_new_data(message: str):
    to_remove = []
    for connection in websocket_connections:
        try:
            await connection.send_text(message)
        except WebSocketDisconnect:
            to_remove.append(connection)
    for conn in to_remove:
        websocket_connections.remove(conn)

@app.get("/health")
async def health_check():
    try:
        # Try a basic Cassandra query
        session.execute("SELECT now() FROM system.local")
        cassandra_status = "UP"
    except Exception:
        cassandra_status = "DOWN"

    return {
        "api_status": "UP",
        "cassandra_status": cassandra_status
    }

@app.get("/demo-query")
async def demo_query():
    from datetime import datetime

    try:
        # Lightweight check to make sure Cassandra is reachable
        session.execute("SELECT now() FROM system.local")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Cassandra is not available.")

    return {"message": "Hello from backend!", "timestamp": datetime.utcnow().isoformat()}

@app.get("/metrics")
async def dummy_metrics():
    return ""

@app.get("/transactions")
async def get_transactions(
    days: int = Query(1, ge=1, le=30, description="How many days back to fetch data for"),
    limit: int = Query(20, gt=0),
    page: int = Query(1, ge=1)
):
    max_rows_needed = limit * 100
    offset = (page - 1) * limit

    latest_row = session.execute("SELECT insert_date FROM alerts.transactions LIMIT 1").one()
    if not latest_row:
        return {"data": []}

    raw_date = latest_row["insert_date"]
    end_date = raw_date.date() if isinstance(raw_date, CassandraDate) else raw_date
    start_date = end_date - datetime.timedelta(days=days - 1)

    selected_fields = [
        "transaction_key", "session_id", "insert_date", "insert_time", "account_number",
        "amount", "first_name", "last_name",
        "field_1", "field_2", "field_3", "field_4", "field_5",
        "field_6", "field_7", "field_8", "field_9", "field_10",
        "field_11", "field_12", "field_13", "field_14", "field_15",
        "field_16", "field_17", "field_18", "field_19", "field_20"
    ]

    all_results = []
    for i in range(days):
        query_date = end_date - datetime.timedelta(days=i)

        query = f"""
            SELECT {', '.join(selected_fields)}
            FROM alerts.transactions
            WHERE insert_date = %s
            LIMIT {max_rows_needed}
        """

        rows = session.execute(query, (query_date,))
        for row in rows:
            result_data = {field: str(row.get(field)) for field in selected_fields}
            all_results.append(result_data)
            if len(all_results) >= max_rows_needed:
                break

        if len(all_results) >= max_rows_needed:
            break

    paginated_results = all_results[offset:offset + limit]
    return {"data": paginated_results}

@app.get("/browse")
async def browse_data(limit: int = 10):
    api_start = time.perf_counter()

    selected_fields = [
        "user_id", "event_date", "event_time", "event_type", "metadata", "session_id", "xml_blob"
    ] + [f"field_{i}" for i in range(1, 100)]

    #excluded_fields = ["dummy_field1", "dummy_field2"]
    #selected_fields = [field for field in selected_fields if field not in excluded_fields]

#    query = f"""
#        SELECT {', '.join(selected_fields)}
#        FROM user_events_with_100_fields
#        LIMIT {limit}
#    """


    query = f"""
        SELECT {', '.join(selected_fields)}
        FROM eventlog.user_events_with_100_fields
        WHERE TOKEN(user_id) > TOKEN(now())
        LIMIT {limit}
    """


    db_start = time.perf_counter()
    rows = session.execute(query)
    db_end = time.perf_counter()

    results = []

    date_fields = [
        "event_date", "field_6", "field_13", "field_20", "field_27", "field_34", "field_41", "field_48",
        "field_55", "field_62", "field_69", "field_76", "field_83", "field_90", "field_97"
    ]

    for row in rows:
        xml_data = None
        if row.get('xml_blob'):
            try:
                xml_str = row['xml_blob'].decode('utf-8')
                xml_tree = ET.fromstring(xml_str)
                xml_data = {elem.tag: elem.text for elem in xml_tree}
                xml_data = json.dumps(xml_data)
            except Exception as e:
                xml_data = {"error": f"Failed to parse XML: {str(e)}"}

        result_data = {
            "user_id": str(row.get("user_id")),
            "event_date": str(row.get("event_date")),
            "event_time": row.get("event_time"),
            "event_type": row.get("event_type"),
            "metadata": row.get("metadata"),
            "session_id": row.get("session_id"),
            "xml_blob": xml_data,
        }

        for key in selected_fields[7:]:  # From field_1 onward
            result_data[key] = row.get(key)

        # Force convert known date fields
        for field in date_fields:
            if field in result_data and result_data[field] is not None:
                result_data[field] = str(result_data[field])

        results.append(result_data)

    api_end = time.perf_counter()

    return {
        "data": results,
        "timing": {
            "db_time": (db_end - db_start) * 1000,  # DB execution time
            "api_time": (api_end - api_start) * 1000,  # Total API time (everything)
            "processing_time": (api_end - db_end) * 1000  # Time after DB (Python processing, XML parsing, etc.)
        }
    }

@app.get("/alerts")
async def get_alerts(
    days: int = Query(1, ge=1, le=30),
    status: str = Query("all", description="Filter by status: new, open, closed, or all"),
    limit: int = Query(20, gt=0),
    page: int = Query(1, ge=1)
):
    selected_fields = [
        "alert_date", "status", "create_timestamp", "alert_id", "region", "tenant", "score", "alert_type", "alert_description",
        "account_number", "amount", "first_name", "last_name",
        "reviewed", "severity", "transaction_key", "transaction_timestamp"
    ]

    try:
        # Try one known partition to fetch latest date safely
        result = session.execute("""
            SELECT alert_date FROM alerts.alerts_by_status
            WHERE status = 'new' LIMIT 1
        """).one()

        end_date = result.alert_date if result and result.alert_date else datetime.date.today()
    except Exception:
        end_date = datetime.date.today()

    start_date = end_date - datetime.timedelta(days=days - 1)
    offset = (page - 1) * limit
    max_rows_needed = limit * 100
    all_results = []

    for i in range(days):
        query_date = end_date - datetime.timedelta(days=i)
        status_values = ["new", "open", "closed"] if status == "all" else [status.lower()]

        for stat in status_values:
            query = f"""
                SELECT {', '.join(selected_fields)}
                FROM alerts.alerts_by_status
                WHERE status = %s AND alert_date = %s
                LIMIT {max_rows_needed}
            """
            try:
                rows = session.execute(query, (stat, query_date))
            except Exception:
                continue

            for row in rows:
                result_data = {}
                for field in selected_fields:
                    val = row.get(field)
                    if field == "reviewed":
                        result_data[field] = val
                    else:
                        result_data[field] = str(val) if val is not None else None
                all_results.append(result_data)

                if len(all_results) >= max_rows_needed:
                    break

            if len(all_results) >= max_rows_needed:
                break

    paginated_results = all_results[offset:offset + limit]
    return {"data": paginated_results}

@app.get("/alert/{alert_id}")
async def get_alert_with_transaction(alert_id: str):
    alert_uuid = UUID(alert_id)

    alert_query = """
        SELECT * FROM alerts.alerts_by_id
        WHERE alert_id = %s
    """
    alert_row = session.execute(alert_query, (alert_uuid,)).one()
    if not alert_row:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert = {k: str(v) if v is not None else None for k, v in alert_row.items()}

    transaction = None
    try:
        transaction_key = UUID(alert["transaction_key"])
        insert_date = alert["alert_date"]  # e.g. '2025-05-14'
        insert_time = datetime.datetime.strptime(alert["create_timestamp"], "%Y-%m-%d %H:%M:%S.%f")

        trans_query = """
            SELECT * FROM alerts.transactions
            WHERE insert_date = %s AND insert_time = %s AND transaction_key = %s
        """
        trans_row = session.execute(trans_query, (insert_date, insert_time, transaction_key)).one()

        if trans_row:
            transaction = {k: str(v) if v is not None else None for k, v in trans_row.items()}
    except Exception as e:
        pass

    return {"alert": alert, "transaction": transaction}


@app.patch("/alert/{alert_id}/reviewed")
async def mark_alert_reviewed(alert_id: str):
    alert_uuid = UUID(alert_id)

    # Step 1: Fetch alert from alerts_by_id to get current data
    row = session.execute("""
        SELECT * FROM alerts.alerts_by_id WHERE alert_id = %s
    """, [alert_uuid]).one()

    if not row:
        return {"error": "Alert not found"}

    alert_date = row["alert_date"]
    create_timestamp = row["create_timestamp"]
    old_status = row["status"]

    print(f"🧹 Deleting old row from alerts_by_status with status={old_status}, date={alert_date}, ts={create_timestamp}, id={alert_uuid}")

    # Step 2: Delete old row in alerts_by_status (using old status!)
    session.execute("""
        DELETE FROM alerts.alerts_by_status
        WHERE status = %s AND alert_date = %s AND create_timestamp = %s AND alert_id = %s
    """, (old_status, alert_date, create_timestamp, alert_uuid))
    print("✅ Deleted old row. Now inserting new row with status=open")

    # Step 3: Insert new row into alerts_by_status with updated status
    new_status = "open"
    session.execute("""
        INSERT INTO alerts.alerts_by_status (
            status, alert_date, create_timestamp, alert_id, tenant, score,
            account_number, alert_description, alert_type, amount,
            first_name, last_name, reviewed, severity,
            transaction_key, transaction_timestamp
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        new_status, alert_date, create_timestamp, alert_uuid,
        row["tenant"], row["score"],
        row["account_number"], row["alert_description"], row["alert_type"],
        row["amount"], row["first_name"], row["last_name"], True,
        row["severity"], row["transaction_key"], row["transaction_timestamp"]
    ))
    print("✅ Inserted new 'open' row.")

    # Step 4: Update alerts_by_id (still the same PK)
    session.execute("""
        UPDATE alerts.alerts_by_id
        SET reviewed = true, status = %s
        WHERE alert_id = %s
    """, (new_status, alert_uuid))
    print("✅ Updated alerts_by_id")

    return {"status": "ok"}

@app.get("/alert/{alert_id}/transaction")
def get_transaction_for_alert(alert_id: str):
    try:
        # Step 1: Lookup alert to find transaction_key, insert_date, and insert_time
        alert_row = session.execute("""
            SELECT transaction_key, alert_date, transaction_timestamp
            FROM alerts.alerts_by_id
            WHERE alert_id = %s
        """, (uuid.UUID(alert_id),)).one()

        if not alert_row:
            raise HTTPException(status_code=404, detail="Alert not found")

        transaction_key = alert_row["transaction_key"]
        insert_date = alert_row["alert_date"]
        insert_time = alert_row["transaction_timestamp"]  # same as insert_time in transactions

        # Step 2: Fetch the transaction by full primary key
        txn_row = session.execute("""
            SELECT * FROM alerts.transactions
            WHERE insert_date = %s AND insert_time = %s AND transaction_key = %s
        """, (insert_date, insert_time, transaction_key)).one()

        if not txn_row:
            raise HTTPException(status_code=404, detail="Transaction not found")

        txn_data = {k: str(v) if v is not None else None for k, v in txn_row.items()}
        return {"transaction": txn_data}

    except Exception as e:
        print(f"❌ Failed to fetch transaction for alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error while fetching transaction")

from cassandra.query import BatchStatement

@app.patch("/alert/{alert_id}/status")
async def update_alert_status(alert_id: str, status_update: StatusUpdateRequest):
    alert_uuid = UUID(alert_id)
    new_status = status_update.status  # Now using the status from the request body

    # Step 1: Fetch alert from alerts_by_id to get current data
    row = session.execute("""
        SELECT * FROM alerts.alerts_by_id WHERE alert_id = %s
    """, [alert_uuid]).one()

    if not row:
        return {"error": "Alert not found"}

    alert_date = row["alert_date"]
    create_timestamp = row["create_timestamp"]
    old_status = row["status"]

    if old_status != new_status:
        print(f"🧹 Deleting old row from alerts_by_status with status={old_status}, date={alert_date}, ts={create_timestamp}, id={alert_uuid}")

        # Create a batch statement for consistency
        #batch = BatchStatement()
        batch = BatchStatement(batch_type=BatchType.UNLOGGED)
        
        # Delete old row from alerts_by_status
        delete_query = session.prepare("""
            DELETE FROM alerts.alerts_by_status
            WHERE status = ? AND alert_date = ? AND create_timestamp = ? AND alert_id = ?
        """)
        batch.add(delete_query, (old_status, alert_date, create_timestamp, alert_uuid))

        # Insert new row into alerts_by_status with updated status
        insert_query = session.prepare("""
            INSERT INTO alerts.alerts_by_status (
                status, alert_date, create_timestamp, alert_id, region, tenant, score,
                account_number, alert_description, alert_type, amount,
                first_name, last_name, reviewed, severity,
                transaction_key, transaction_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """)
        batch.add(insert_query, (
            new_status, alert_date, create_timestamp, alert_uuid,
            row["region"], row["tenant"], row["score"],
            row["account_number"], row["alert_description"], row["alert_type"],
            row["amount"], row["first_name"], row["last_name"], row["reviewed"],
            row["severity"], row["transaction_key"], row["transaction_timestamp"]
        ))

        # Update alerts_by_id with new status
        update_query = session.prepare("""
            UPDATE alerts.alerts_by_id
            SET status = ?
            WHERE alert_id = ?
        """)
        batch.add(update_query, (new_status, alert_uuid))

        # Execute the batch
        session.execute(batch)
        print("✅ Batch update of alert status completed")

    return {"status": "ok"}


@app.get("/events/{user_id}")
def get_user_events(user_id: str):
    start_time = time.time()
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    uuid_validation_time = (time.time() - start_time) * 1000

    query = """
        SELECT user_id, event_date, event_time, event_type, metadata, session_id, xml_blob
        FROM eventlog.user_events_with_100_fields
        WHERE user_id = %s
    """
    db_start_time = time.time()
    rows = session.execute(query, (user_uuid,))
    db_query_time = (time.time() - db_start_time) * 1000

    results = []
    for row in rows:
        xml_data = None
        if row['xml_blob']:
            try:
                xml_str = row['xml_blob'].decode('utf-8')
                xml_tree = ET.fromstring(xml_str)
                xml_data = {elem.tag: elem.text for elem in xml_tree}
            except Exception as e:
                xml_data = {"error": f"Failed to parse XML: {str(e)}"}

        results.append({
            "user_id": str(row["user_id"]),
            "event_date": str(row["event_date"]),
            "event_time": row["event_time"],
            "event_type": row["event_type"],
            "metadata": row["metadata"],
            "session_id": row["session_id"],
            "xml_blob": xml_data,
        })

    if not results:
        raise HTTPException(status_code=404, detail="No events found for this user")

    response_time = (time.time() - start_time) * 1000

    return {
        "data": results,
        "timing": {
            "webToApi": uuid_validation_time,
            "apiToDb": db_query_time,
            "dbFetch": db_query_time,
            "dbToWeb": response_time - (uuid_validation_time + db_query_time),
        }
    }

#@app.get("/random_user_ids")
#def get_random_user_ids():
#    query = "SELECT user_id FROM eventlog.user_events_with_100_fields LIMIT 5000"
#    rows = session.execute(query)
#    user_ids = [str(row["user_id"]) for row in rows]
#    if not user_ids:
#        raise HTTPException(status_code=404, detail="No users found.")
#    random_ids = random.sample(user_ids, min(20, len(user_ids)))
#    return {"user_ids": random_ids}

@app.get("/random_user_ids")
def get_random_user_ids():
    query = f"""
        SELECT user_id FROM eventlog.user_events_with_100_fields
        WHERE TOKEN(user_id) > TOKEN(now())
        LIMIT 1000;
    """
    rows = session.execute(query)
    user_ids = [str(row["user_id"]) for row in rows]
    if not user_ids:
        raise HTTPException(status_code=404, detail="No users found.")
    return {"user_ids": user_ids}

@app.get("/events/full/{user_id}")
def get_user_full_event_data(user_id: str):
    start_time = time.time()
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    uuid_validation_time = (time.time() - start_time) * 1000

    selected_fields = [
        "user_id", "event_date", "event_time", "event_type", "metadata", "session_id", "xml_blob"
    ] + [f"field_{i}" for i in range(1, 100)]

    #excluded_fields = ["dummy_field1", "dummy_field2"]
    #selected_fields = [field for field in selected_fields if field not in excluded_fields]

    #excluded_fields = ["dummy_field1", "dummy_field2"]
    #selected_fields = [field for field in selected_fields]

    query = f"""
        SELECT {', '.join(selected_fields)}
        FROM eventlog.user_events_with_100_fields
        WHERE user_id = %s
    """
    db_start_time = time.time()
    rows = session.execute(query, (user_uuid,))
    db_query_time = (time.time() - db_start_time) * 1000

    results = []
    for row in rows:
        xml_data = None
        if row['xml_blob']:
            try:
                xml_str = row['xml_blob'].decode('utf-8')
                xml_tree = ET.fromstring(xml_str)
                xml_data = {elem.tag: elem.text for elem in xml_tree}
            except Exception as e:
                xml_data = {"error": f"Failed to parse XML: {str(e)}"}

        result_data = {
            "user_id": str(row["user_id"]),
            "event_date": str(row["event_date"]),
            "event_time": row["event_time"],
            "event_type": row["event_type"],
            "metadata": row["metadata"],
            "session_id": row["session_id"],
            "xml_blob": xml_data,
        }

        for key in selected_fields[4:]:
            result_data[key] = row.get(key)

        date_fields = [
            "event_date", "field_6", "field_13", "field_20", "field_27", "field_34", "field_41", "field_48",
            "field_55", "field_62", "field_69", "field_76", "field_83", "field_90", "field_97"
        ]
        for field in date_fields:
            if field in row:
                result_data[field] = str(row[field])

        results.append(result_data)

    if not results:
        raise HTTPException(status_code=404, detail="No events found for this user")

    response_time = (time.time() - start_time) * 1000
    return {
        "data": results,
        "timing": {
            "webToApi": uuid_validation_time,
            "apiToDb": db_query_time,
            "dbFetch": db_query_time,
            "dbToWeb": response_time - (uuid_validation_time + db_query_time),
        }
    }

@app.post("/insert-random")
async def insert_random_row():
    user_id = uuid.uuid4()
    event_type = random.choice(["click", "view", "purchase", "signup"])
    session_id = str(uuid.uuid4())
    metadata = f"auto-generated {random.randint(1000, 9999)}"
    event_date = "2025-01-01"
    event_time = int(time.time())
    xml_blob = "<data><auto>yes</auto></data>".encode('utf-8')

    query = """
    INSERT INTO user_events_with_100_fields (user_id, event_date, event_time, event_type, metadata, session_id, xml_blob)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    session.execute(query, (user_id, event_date, event_time, event_type, metadata, session_id, xml_blob))

    await broadcast_new_data(f"New row added for user_id: {user_id}")
    return {"status": "inserted", "user_id": str(user_id)}

@app.post("/run-query")
async def run_query(request: Request):
    start_time = time.time()
    body = await request.json()
    cql_query = body.get("query")

    if not cql_query:
        raise HTTPException(status_code=400, detail="No query provided.")

    try:
        db_start = time.time()
        rows = session.execute(SimpleStatement(cql_query))
        db_end = time.time()
        data = [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query failed: {str(e)}")

    return {
        "data": data,
        "timing": {
            "queryTimeMs": (db_end - db_start) * 1000,
            "totalTimeMs": (time.time() - start_time) * 1000
        }
    }

@app.post("/refresh_alerts_by_type")
def refresh_alerts_by_type():
    try:
        rows = session.execute("SELECT alert_type FROM alerts.alerts_by_status")
        counter = {}

        for row in rows:
            alert_type = row.get("alert_type")
            if alert_type:
                counter[alert_type] = counter.get(alert_type, 0) + 1

        for alert_type, count in counter.items():
            session.execute("""
                INSERT INTO alerts.dash_alerts_by_type (alert_type, count)
                VALUES (%s, %s)
            """, (alert_type, count))

        return {"status": "refreshed", "data": counter}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard/alerts_by_type")
def get_alerts_by_type_dashboard():
    try:
        result = session.execute("SELECT * FROM alerts.dash_alerts_by_type")
        data = []

        for row in result:
            # If `row` is a Cassandra Row object
            try:
                data.append({
                    "alert_type": row.alert_type,
                    "count": row.count
                })
            except AttributeError:
                # fallback to dictionary if needed
                data.append({
                    "alert_type": row["alert_type"],
                    "count": row["count"]
                })

        return {"data": data}

    except Exception as e:
        print("Error in /dashboard/alerts_by_type:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/refresh_alerts_by_tenant")
def refresh_alerts_by_tenant():
    try:
        rows = session.execute("SELECT tenant FROM alerts.alerts_by_status")
        counter = {}

        for row in rows:
            tenant = str(row.get("tenant"))  # ✅ Ensure tenant is a string
            if tenant:
                counter[tenant] = counter.get(tenant, 0) + 1

        for tenant, count in counter.items():
            session.execute("""
                INSERT INTO alerts.dash_alerts_by_tenant (tenant, count)
                VALUES (%s, %s)
            """, (tenant, count))

        return {"status": "refreshed", "data": counter}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard/alerts_by_tenant")
def get_alerts_by_tenant_dashboard():
    try:
        result = session.execute("SELECT * FROM alerts.dash_alerts_by_tenant")
        data = []

        for row in result:
            try:
                data.append({
                    "tenant": row.tenant,
                    "count": row.count
                })
            except AttributeError:
                data.append({
                    "tenant": row["tenant"],
                    "count": row["count"]
                })

        return {"data": data}
    except Exception as e:
        print("Error in /dashboard/alerts_by_tenant:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/refresh_alerts_by_score_range")
def refresh_alerts_by_score_range():
    try:
        rows = session.execute("SELECT score FROM alerts.alerts_by_status")
        buckets = {
            "0–60": 0,
            "61–65": 0,
            "66–70": 0,
            "71–75": 0,
            "76–80": 0,
            "81–85": 0,
            "86–90": 0,
            "91–95": 0,
            "96–100": 0
        }

        for row in rows:
            score = row.get("score")
            if score is None:
                continue
            try:
                score = float(score)
                if score <= 60:
                    buckets["0–60"] += 1
                elif score <= 65:
                    buckets["61–65"] += 1
                elif score <= 70:
                    buckets["66–70"] += 1
                elif score <= 75:
                    buckets["71–75"] += 1
                elif score <= 80:
                    buckets["76–80"] += 1
                elif score <= 85:
                    buckets["81–85"] += 1
                elif score <= 90:
                    buckets["86–90"] += 1
                elif score <= 95:
                    buckets["91–95"] += 1
                else:
                    buckets["96–100"] += 1
            except:
                continue

        for bucket, count in buckets.items():
            session.execute("""
                INSERT INTO alerts.dash_alerts_by_score_range (score_range, count)
                VALUES (%s, %s)
            """, (bucket, count))

        return {"status": "refreshed", "data": buckets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard/alerts_by_score_range")
def get_alerts_by_score_range():
    try:
        rows = session.execute("SELECT * FROM alerts.dash_alerts_by_score_range")
        data = []

        for row in rows:
            try:
                data.append({
                    "score_range": row.score_range,
                    "count": row.count
                })
            except AttributeError:
                data.append({
                    "score_range": row["score_range"],
                    "count": row["count"]
                })

        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/refresh_alerts_by_region")
def refresh_alerts_by_region():
    try:
        rows = session.execute("SELECT region FROM alerts.alerts_by_status")
        counter = {}

        for row in rows:
            # Compatible with namedtuple or dict-like row
            region = row.get("region") if isinstance(row, dict) else getattr(row, "region", None)
            if region:
                counter[region] = counter.get(region, 0) + 1

        # Optionally clear the table before inserting to avoid duplicates
        session.execute("TRUNCATE alerts.dash_alerts_by_region")

        for region, count in counter.items():
            session.execute("""
                INSERT INTO alerts.dash_alerts_by_region (region, count)
                VALUES (%s, %s)
            """, (region, count))

        return {"status": "refreshed", "data": counter}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard/alerts_by_region")
def get_alerts_by_region():
    try:
        rows = session.execute("SELECT region, count FROM alerts.dash_alerts_by_region")
        #return {"data": [dict(row._asdict()) for row in rows]}
        return {"data": [dict(row) for row in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

