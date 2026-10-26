#!/usr/bin/env python3
"""Host checks; SMTP is enabled only after an alert recipient is configured.

A process on EC2 cannot detect the loss of its own host. External uptime
monitoring must be configured separately.
"""
import argparse
import fcntl
import json
import shutil
import smtplib
import socket
import ssl
import subprocess
import time
import urllib.request
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
CONFIG = Path('/home/ubuntu/.config/ginder-ops/monitor.json')
STATE = Path('/home/ubuntu/.local/state/ginder-ops')


def command(*args):
    return subprocess.run(args, capture_output=True, text=True, timeout=10, check=False)


def collect(config):
    problems = []
    origin = config.get('origin', 'https://ginder-app.duckdns.org')
    try:
        with urllib.request.urlopen(origin + '/health/ready', timeout=12) as response:
            if response.status != 200 or json.load(response).get('status') != 'ready':
                problems.append('API readiness failed')
    except Exception:
        problems.append('API HTTPS unavailable')
    disk = shutil.disk_usage(ROOT)
    if disk.used * 100 / disk.total >= config.get('disk_percent', 80):
        problems.append('Disk usage above threshold')
    memory = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    total = int(memory['MemTotal'].split()[0])
    available = int(memory['MemAvailable'].split()[0])
    if (total - available) * 100 / total >= config.get('memory_percent', 90):
        problems.append('Memory usage above threshold')
    for service in ('backend', 'celery-worker', 'celery-beat', 'db', 'redis', 'caddy'):
        result = command('docker', 'inspect', '--format', '{{.State.Health.Status}}',
                         f'ginder-production-{service}-1')
        if result.returncode or result.stdout.strip() != 'healthy':
            problems.append(f'Unhealthy service: {service}')
    success = STATE / 'backup-success'
    try:
        if time.time() - int(success.read_text().strip()) > 27 * 3600:
            problems.append('Backup older than 27 hours')
    except (OSError, ValueError):
        problems.append('No successful scheduled backup recorded')
    if command('systemctl', 'is-failed', '--quiet', 'ginder-backup.service').returncode == 0:
        problems.append('Backup service failed')
    try:
        host = urlsplit(origin).hostname
        with socket.create_connection((host, 443), timeout=8) as tcp:
            with ssl.create_default_context().wrap_socket(tcp, server_hostname=host) as tls:
                remaining = ssl.cert_time_to_seconds(tls.getpeercert()['notAfter']) - time.time()
                if remaining < 14 * 86400:
                    problems.append('TLS certificate expires within 14 days')
    except Exception:
        problems.append('TLS certificate check failed')
    return sorted(problems)


def smtp_config():
    values = {}
    for line in (ROOT / '.env.production').read_text().splitlines():
        key, separator, value = line.partition('=')
        key = key.strip()
        if separator and key in {'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD',
                                 'SMTP_SECURITY', 'EMAIL_FROM'}:
            value = value.strip()
            if value.startswith('"') and value.endswith('"'):
                value = json.loads(value)
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            values[key] = value
    return values


def notify(recipient, problems):
    settings = smtp_config()
    message = EmailMessage()
    message['From'] = settings['EMAIL_FROM']
    message['To'] = recipient
    message['Subject'] = '[Ginder] ' + ('Operational alert' if problems else 'Recovered')
    message.set_content('\n'.join(problems) if problems else 'All operational checks recovered.')
    context = ssl.create_default_context()
    host = settings['SMTP_HOST']
    port = int(settings.get('SMTP_PORT', '587'))
    if settings.get('SMTP_SECURITY') == 'ssl':
        smtp = smtplib.SMTP_SSL(host, port, timeout=15, context=context)
    else:
        smtp = smtplib.SMTP(host, port, timeout=15)
        smtp.starttls(context=context)
    with smtp:
        smtp.login(settings['SMTP_USER'], settings['SMTP_PASSWORD'])
        smtp.send_message(message)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='No notifications or state changes')
    parser.add_argument('--disk-threshold', type=int)
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    if args.disk_threshold is not None:
        config['disk_percent'] = args.disk_threshold
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (STATE / 'monitor.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        problems = collect(config)
        print(json.dumps({'problems': problems, 'email_alerts_configured': bool(config.get('alert_email'))}))
        if args.dry_run:
            return 1 if problems else 0
        state_path = STATE / 'monitor.json'
        previous = json.loads(state_path.read_text()) if state_path.exists() else {}
        notified = previous.get('notified_problems', [])
        last_alert = previous.get('last_alert', 0)
        now = time.time()
        if config.get('alert_email') and (problems != notified or (problems and now-last_alert > 21600)):
            try:
                notify(config['alert_email'], problems)
                notified, last_alert = problems, now
            except Exception as error:
                print('SMTP delivery failed: ' + type(error).__name__)
                problems.append('Alert delivery failed')
        temporary = STATE / 'monitor.json.new'
        temporary.write_text(json.dumps({'problems': problems, 'checked_at': now,
                                        'notified_problems': notified, 'last_alert': last_alert}))
        temporary.replace(state_path)
        return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
