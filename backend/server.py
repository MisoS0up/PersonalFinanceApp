from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from datetime import datetime
import argparse
import json
import threading
import uuid

ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = ROOT / "frontend"
DATA_FILE = ROOT / "data" / "sync-data.json"
FILE_LOCK = threading.Lock()


def today():
    return datetime.now().strftime("%Y-%m-%d")


def peso(amount):
    return f"₱{amount:,.2f}"


def now_iso():
    return datetime.now().isoformat()


def empty_payload():
    return {
        "data": {
            "profileName": "My Wealth",
            "budget": {"income": 15000, "needs": 50, "wants": 30, "savings": 15, "invest": 5},
            "savings": [],
            "expenses": [],
            "activity": [],
            "stocks": [],
            "goal": 100000,
        },
        "updatedAt": None,
    }


def find_account(savings, name):
    if not name:
        return None
    needle = str(name).strip().lower()
    for account in savings or []:
        if str(account.get("name", "")).strip().lower() == needle:
            return account
    return None


def account_names(payload):
    data = payload.get("data") or {}
    names = []
    for account in data.get("savings") or []:
        name = str(account.get("name") or "").strip()
        if name:
            names.append(name)
    return names


def apply_expense(payload, name, amount, account_name, existing=None):
    data = payload.setdefault("data", {})
    data.setdefault("savings", [])
    data.setdefault("expenses", [])
    data.setdefault("activity", [])
    linked = find_account(data["savings"], account_name) if account_name else None
    if account_name and not linked:
        account_name = ""
    expense = existing or {
        "id": str(uuid.uuid4()),
        "source": "shortcut",
        "name": name,
        "amount": amount,
        "account": linked["name"] if linked else "",
        "accountNote": "",
        "date": today(),
    }
    account_note = expense.get("accountNote") or ""
    if linked:
        linked["amount"] = float(linked.get("amount") or 0) - amount
        if not account_note:
            account_note = f"{expense.get('date') or today()} · Spent {peso(amount)} on {name}"
            expense["accountNote"] = account_note
        notes = linked.get("notes") or []
        if account_note not in notes:
            notes.append(account_note)
        linked["notes"] = notes[-3:]
        expense["account"] = linked["name"]
    data["expenses"].append(expense)
    if not any(a.get("expenseId") == expense.get("id") for a in data["activity"] if expense.get("id")):
        data["activity"].append({
            "type": "expense",
            "name": name,
            "amount": amount,
            "date": expense.get("date") or today(),
            "expenseId": expense.get("id"),
        })
    payload["updatedAt"] = now_iso()
    return expense


def merge_shortcut_expenses(incoming, existing):
    if not existing or not isinstance(existing.get("data"), dict):
        return incoming
    incoming_data = incoming.setdefault("data", {})
    incoming_data.setdefault("expenses", [])
    incoming_ids = {item.get("id") for item in incoming_data.get("expenses") or [] if item.get("id")}
    deleted_ids = set(incoming_data.get("deletedExpenseIds") or [])

    if deleted_ids and isinstance(existing.get("data"), dict):
        existing["data"]["expenses"] = [
            e for e in (existing["data"].get("expenses") or [])
            if e.get("id") not in deleted_ids
        ]
        existing["data"]["activity"] = [
            a for a in (existing["data"].get("activity") or [])
            if a.get("expenseId") not in deleted_ids
        ]

    for expense in existing["data"].get("expenses") or []:
        eid = expense.get("id")
        if expense.get("source") != "shortcut" or not eid or eid in incoming_ids or eid in deleted_ids:
            continue
        apply_expense(
            incoming,
            expense.get("name") or "Expense",
            float(expense.get("amount") or 0),
            expense.get("account") or "",
            existing=expense,
        )
    return incoming


class WealthHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_OPTIONS(self):
        if self.api_path().startswith("/api/"):
            self.send_response(204)
            self.add_cors_headers()
            self.end_headers()
            return
        self.send_error(404)

    def do_GET(self):
        path = self.api_path()
        query = self.query()
        if path == "/api/data":
            self.send_json(self.read_data())
            return
        if path in {"/api/accounts", "/api/accounts.txt"}:
            names = account_names(self.read_data())
            if path.endswith(".txt") or query.get("format", [""])[0] == "text":
                self.send_text("\n".join(names) + ("\n" if names else ""))
                return
            self.send_json(names)
            return
        if path in {"/api/expenses", "/api/add-expense"}:
            if "name" in query or "amount" in query:
                self.handle_add_expense(self.expense_from_map({
                    key: values[0] if values else ""
                    for key, values in query.items()
                }))
                return
            if path == "/api/add-expense":
                self.send_json({
                    "ok": False,
                    "message": "Add name and amount, for example /api/add-expense?name=Coffee&amount=180&account=GoTyme",
                }, status=400)
                return
            payload = self.read_data()
            self.send_json({
                "ok": True,
                "expenses": (payload.get("data") or {}).get("expenses") or [],
            })
            return
        super().do_GET()

    def do_POST(self):
        path = self.api_path()
        if path == "/api/data":
            self.handle_sync()
            return
        if path in {"/api/expenses", "/api/add-expense"}:
            self.handle_add_expense(self.read_expense_body())
            return
        self.send_error(404)

    def handle_sync(self):
        try:
            incoming = json.loads(self.read_body())
            if not isinstance(incoming.get("data"), dict):
                raise ValueError("invalid data")
            with FILE_LOCK:
                existing = self.read_data_unlocked()
                merged = merge_shortcut_expenses(incoming, existing)
                self.write_data_unlocked(merged)
            self.send_json(merged)
        except (ValueError, json.JSONDecodeError):
            self.send_json({"ok": False, "message": "Invalid sync data"}, status=400)

    def handle_add_expense(self, fields):
        try:
            name = str(fields.get("name") or "").strip()
            account = str(fields.get("account") or "").strip()
            amount = float(fields.get("amount"))
            if not name:
                raise ValueError("Enter an expense name.")
            if not (amount > 0):
                raise ValueError("Enter an amount greater than zero.")
        except (TypeError, ValueError) as error:
            message = str(error)
            if "could not convert" in message or "float" in message:
                message = "Enter a valid amount greater than zero."
            self.send_json({"ok": False, "message": message}, status=400)
            return
        try:
            with FILE_LOCK:
                payload = self.read_data_unlocked()
                if not isinstance(payload.get("data"), dict):
                    payload = empty_payload()
                expense = apply_expense(payload, name, amount, account)
                self.write_data_unlocked(payload)
            account_label = expense.get("account") or "no linked account"
            message = f"Saved {expense['name']} for {peso(expense['amount'])} from {account_label}."
            print(f"Shortcut expense: {message}")
            self.send_json({"ok": True, "message": message, "expense": expense})
        except ValueError as error:
            self.send_json({"ok": False, "message": str(error)}, status=400)

    def expense_from_map(self, fields):
        return {
            "name": fields.get("name") or fields.get("item") or "",
            "amount": fields.get("amount") or fields.get("value") or "",
            "account": fields.get("account") or fields.get("from") or "",
        }

    def read_expense_body(self):
        raw = self.read_body()
        if not raw:
            return self.expense_from_map({
                key: values[0] if values else ""
                for key, values in self.query().items()
            })
        content_type = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if content_type in {"application/x-www-form-urlencoded", "text/plain"}:
            parsed = parse_qs(raw, keep_blank_values=True)
            return self.expense_from_map({key: values[0] if values else "" for key, values in parsed.items()})
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            parsed = parse_qs(raw, keep_blank_values=True)
            if parsed:
                return self.expense_from_map({key: values[0] if values else "" for key, values in parsed.items()})
            raise
        if not isinstance(payload, dict):
            raise ValueError("invalid data")
        return self.expense_from_map(payload)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return ""
        return self.rfile.read(length).decode("utf-8")

    def read_data(self):
        with FILE_LOCK:
            return self.read_data_unlocked()

    def read_data_unlocked(self):
        if not DATA_FILE.exists():
            return empty_payload()
        try:
            payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                return empty_payload()
            return payload
        except (OSError, json.JSONDecodeError):
            return empty_payload()

    def write_data_unlocked(self, payload):
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        temp_file = DATA_FILE.with_suffix(".json.tmp")
        temp_file.write_text(json.dumps(payload), encoding="utf-8")
        temp_file.replace(DATA_FILE)

    def api_path(self):
        return urlparse(self.path).path.rstrip("/") or "/"

    def query(self):
        return parse_qs(urlparse(self.path).query, keep_blank_values=True)

    def add_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.add_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text, status=200):
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.add_cors_headers()
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the My Wealth LAN sync server")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    print(f"My Wealth sync server: http://0.0.0.0:{args.port}")
    print("iPhone Shortcut: POST /api/expenses or GET /api/add-expense?name=Coffee&amount=180&account=GoTyme")
    ThreadingHTTPServer(("0.0.0.0", args.port), WealthHandler).serve_forever()
