# What We're Building

Plain-language description of the two halves of the product and why they are one
product. For the architecture and the build order, see
`docs/superpowers/specs/2026-09-09-unified-platform-design.md`.

## In one sentence

Software that does a small business's routine growth work, for an owner who has no IT
team — including walking them through the setup steps that normally require one.

## The customer

A small business owner. In the first case, a printing and design shop in Jaipur. They
have a website, a Google listing, customers, and no marketing person. Hiring an agency
costs more than the work is worth to them. The growth work that would actually help —
keeping the Google listing current, fixing weak page titles, answering reviews, quoting
faster — is repetitive, endless, and never the most urgent thing on a given day.

They are not going to read documentation. They are not going to configure anything that
uses the words "OAuth", "API key", or "DNS record". Any product that requires those
things has already lost them, no matter how good the rest of it is.

---

## BusinessOS — the growth OS

**What it is.** A system that learns how a specific business works, then does its
routine growth work, and asks permission before anything that matters.

**What it knows.** The Company Brain holds facts about the business — services,
pricing, locations, brand voice, working hours — each with a record of where the fact
came from, how confident the system is in it, and whether it conflicts with something
else it was told. This is what separates it from a generic chatbot: it does not guess
about the business, and when it does not know something it can say so and ask.

**What it does today.** The SEO loop is the part that runs end to end. It reads real
Search Console data, finds pages that are being seen but not clicked, proposes a better
title and description, checks that proposal against verified facts about the business
(so it cannot invent a service the shop does not offer), routes it for approval, writes
it to a staging draft, and then verifies that the live site was not touched. Alongside
that: catalog and pricing with margin guards, a read-only website crawler and SEO audit,
and a grounded chat that answers questions about the business from what it actually knows.

**What it will not do.** It stops at the production boundary, deliberately. Publishing
to the live site is a hard-disabled capability. The WordPress connector writes to staging
only. The verification step *fails* if the production page changed. A global kill switch
sits over every external write. Nothing reaches the public internet without a person
saying yes.

**Where it runs.** On the owner's machine. The default models are local — Qwen3 4B for
generation, EmbeddingGemma for retrieval — so business data does not leave by default.
A cloud model is an opt-in fallback, with the key encrypted in a local vault. Every
action is written to a tamper-evident audit log, each entry hash-chained to the one
before it.

---

## PointAI — the guide

**What it is.** An assistant that looks at a web page with the owner and points at the
exact thing they need to click, and tells them what to type into it.

**The problem it solves.** Connecting a business to its own tools is the hardest part of
using any system like this. Verifying a property in Search Console. Creating an OAuth
application in Google Cloud Console. Generating an application password in WordPress
admin. These are short tasks that are trivially easy if you have done them before and
genuinely impossible if you have not. Written instructions go stale the moment the
vendor redesigns a screen, and every support article assumes you already know the
vocabulary.

**How it works.** The owner says what they want in plain English — "connect my Search
Console". PointAI reads the interactive elements actually present on the page in front
of them, works out which one moves them toward that goal, and highlights it. When the
task takes several screens, it lays out the path as short steps and tracks where they
are. When it has solved that goal on that site before, it reuses the answer instantly —
but it re-checks the remembered element against the live page first, and forgets the
answer if the page has changed, so a vendor redesign produces a fresh look rather than a
confident wrong arrow.

**What it will not do.** It does not click. It does not type. It does not submit forms.
It never touches a password or a credential. The person does every action themselves.

This is a permanent product boundary, not a first-version shortcut. It is what keeps the
system out of the credential path entirely, keeps it working with two-factor prompts and
passkeys, and keeps it clear of the terms of service that forbid automated access to
those accounts. It also mirrors what the rest of the system already does: the software
goes right up to the line, and a human crosses it.

---

## Why neither half is enough alone

**BusinessOS is blocked by its own front door.** Its status document is direct about it:
every external integration needs an OAuth application, approved scopes, credentials, and
a configured business account. All of that setup happens inside third-party consoles,
behind logins, in accounts the software cannot and should not operate. So the system can
be genuinely good at the recurring work and still be unusable by the exact person it was
built for, because they cannot get through the setup to reach it.

**PointAI alone is a tool you use once.** It can guide someone through a setup
beautifully, and then it is done. It knows nothing about the business, has nothing to do
after the connection is made, and no reason to be opened again next week. Useful, but
not a product someone pays for monthly.

Each one is the other's missing half. PointAI gets the owner across the boundaries
BusinessOS cannot cross; BusinessOS is the reason crossing them is worth doing.

---

## How they work together

The division is consistent and easy to state:

| | Who does it | Why |
|---|---|---|
| Anything inside a third-party account | The owner, guided | Credentials, 2FA, terms of service |
| Anything publishing to the live site | The owner, after approval | Production boundary, hard-denied in policy |
| Everything else — reading, analyzing, proposing, drafting, staging, verifying | The system | Recurring, safe, reversible |

A first run looks like this:

1. The owner installs one application and opens one dashboard.
2. They say they want their website and Google Search Console connected.
3. The guidance panel opens the real pages and walks them click by click — into Search
   Console to verify the property, into WordPress admin to create an application
   password. They do the typing. The credentials go straight into the encrypted vault;
   the guidance layer never sees them.
4. BusinessOS takes over. It reads their Search Console data, finds that their brochure
   printing page is shown often and clicked rarely, and proposes a better title — checked
   against the services and locations it has verified they actually offer.
5. The proposal appears in the approvals inbox with the before and after side by side.
   The owner approves it.
6. It is written as a WordPress staging draft. The system confirms the live site is
   untouched, logs every step, and keeps a rollback point.
7. The owner publishes when they are ready.

From then on, steps 4 through 7 repeat on their own. Step 3 happens once.

---

## What this is not

It is not an agent with the keys to the business. It does not log into accounts, hold
passwords, or push changes to a live website on its own. It is not a chatbot bolted onto
a dashboard — the value is in the controlled pipeline behind the conversation, not the
conversation. And it is not trying to be an all-in-one marketing suite; several of those
exist and are years ahead. The narrow thing it does that they do not is meet an owner who
has no technical help at the point where every one of those products currently loses them.
