"""生成许可证密钥：SVTOOL-XXXX-XXXX-XXXX-XXXX

用法：
    uv run python scripts/gen_license.py --max-devices 1 --monthly-limit 100 --note "客户A"
"""
import argparse
import secrets
import string
import sys
from datetime import datetime
from pathlib import Path

# Allow running from cloud-backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.session import SessionLocal, init_db
from db.models import License


ALPHABET = string.ascii_uppercase + string.digits


def generate_key() -> str:
    parts = ["SVTOOL"]
    for _ in range(4):
        parts.append("".join(secrets.choice(ALPHABET) for _ in range(4)))
    return "-".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a new license key")
    parser.add_argument("--max-devices", type=int, default=1, help="Max device activations")
    parser.add_argument("--monthly-limit", type=int, default=100, help="Monthly Claude API calls")
    parser.add_argument("--expires-days", type=int, default=0, help="Days until expiry (0 = perpetual)")
    parser.add_argument("--note", type=str, default="", help="Internal note")
    args = parser.parse_args()

    init_db()

    key = generate_key()
    expires_at = None
    if args.expires_days > 0:
        from datetime import timedelta

        expires_at = datetime.utcnow() + timedelta(days=args.expires_days)

    db = SessionLocal()
    try:
        lic = License(
            key=key,
            status="inactive",
            max_devices=args.max_devices,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
            monthly_limit=args.monthly_limit,
            note=args.note,
        )
        db.add(lic)
        db.commit()
        print(f"✓ License generated: {key}")
        print(f"  max_devices   = {args.max_devices}")
        print(f"  monthly_limit = {args.monthly_limit}")
        print(f"  expires_at    = {expires_at or 'perpetual'}")
        print(f"  note          = {args.note or '(empty)'}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
