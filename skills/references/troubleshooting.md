# Resend CLI — Troubleshooting Guide

## First Response Checklist

Always start with diagnostics before branching into specific issues:

1. Run `resend doctor --json` — surfaces CLI version, API key validity, domain health in one shot
2. Run `resend domains list --json` — check verification status and capabilities
3. Based on results, branch into the relevant section below

---

## Domain Issues

**Verification stuck / DNS not propagating**
- Run `resend domains get <id> --json` to see the exact DNS records required
- Compare required records against what's actually configured (user may need to check their DNS provider)
- Trigger a re-check with `resend domains verify <id>`
- DNS propagation can take up to 72 hours — if records are correct, advise patience
- Common mistake: CNAME vs TXT record confusion, or trailing dots in record values

**Sending or receiving not enabled**
- Check the `capabilities` field in `resend domains get` output
- Sending requires verified domain + valid DKIM/SPF records
- Receiving requires explicit enablement on the domain (not on by default)

---

## Delivery Issues

**Bounces**
- Run `resend emails list --limit 50 --json` and filter for bounced status
- Get bounce details with `resend emails get <id> --json` — look for bounce type (hard vs soft) and reason
- Hard bounces: invalid address, remove from contacts
- Soft bounces: mailbox full, temporary issue — may resolve on retry

**Complaints (spam reports)**
- Check `resend emails list` for complained status
- High complaint rates risk domain reputation — investigate content and list hygiene
- Ensure unsubscribe links work and are prominent

**Delayed delivery**
- Check for `delivery_delayed` status in email details
- May indicate recipient server throttling — usually resolves within hours

---

## Auth Issues

**No API key found**
- Verify `.env.local` or `.env` contains `RESEND_API_KEY`
- If using CLI profiles, run `resend whoami` to check active profile
- Run `resend auth list` to see available profiles

**Wrong profile / key invalid**
- `resend whoami` shows which profile and key source is active
- `resend auth switch --name <profile>` to change profiles
- `resend doctor` will validate whether the current key is accepted by the API

---

## Webhook Issues

**Events not arriving**
- Run `resend webhooks list --json` to confirm the endpoint URL and subscribed events
- Check webhook status — ensure it's not `disabled`
- Use `resend webhooks listen` for local development to verify payload shape
- Verify the endpoint returns 2xx — Resend retries on failure but will eventually disable

**Signature validation failing**
- Payloads are signed with Svix headers: `svix-id`, `svix-timestamp`, `svix-signature`
- Ensure the webhook signing secret matches what's in `resend webhooks get <id>`
- Check for clock skew — timestamp tolerance is typically 5 minutes
