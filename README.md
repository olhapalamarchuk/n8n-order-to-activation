# Order-to-Activation Automation (n8n + Gemini, built with Codex)

**Status: working prototype.** The full flow runs end to end: contract upload, AI extraction, rule-based validation,
human approval, billing agreement, subscriptions, notifications, audit log and error handling.
See [Test results](#test-results) and [Known limitations](#known-limitations).

An n8n prototype that redesigns a manual, multi-team cloud order activation process into one upload and one approval.
Based on an order activation process I designed and owned in a previous role, rebuilt with a fictional company
(*Nimbus Cloud*), fictional customers and simulated systems.

## The problem

Activating a managed cloud order involved Sales, Sales Ops, Order Processing, Cloud Ops and Billing:

- six manual handoffs, mostly by email
- the same data typed into several systems (the disaster recovery type was entered twice)
- unclear inputs for Cloud Ops engineers
- business rules living in runbooks and in people's heads: 60-character subscription names,
  a separate cloud account for Australian customers, 2–3 environments per activation
- different scripts for the same step in different regions

## The redesign

```mermaid
flowchart LR
  A[Sales uploads signed PDF] --> B[LLM extracts order data]
  B --> C{Validation rules}
  C -- invalid --> D[Sales gets the exact issues]
  C -- valid --> E[Cloud Ops approval form]
  E -- reject --> D
  E -- approve --> F[Billing agreement]
  F --> G[Create subscriptions<br/>reusable sub-workflow]
  G --> H[Notify customer, Billing,<br/>Sales, Order Processing]
  E -. every decision .-> L[(Order events log)]
  H -.-> L
  G -. failure .-> I[Manual fallback task]
```

**Design principle: AI extracts, rules decide, humans approve.**

- An LLM reads the unstructured contract and returns structured data, including missing, uncertain and suspicious content.
- Deterministic code re-checks completeness, compares the contract with what Sales entered, selects the regional
  account and generates subscription names within 60 characters. The rules live in code, not in the prompt,
  so the model can be swapped without changing the process.
- Cloud Ops approves every activation, with the AI summary and all warnings shown on the approval form.
- The contract is treated as data, not instructions (test case 5 contains an injected instruction).
- **Append-only audit trail:** orders are stored as received; every status change (approved, rejected, activated)
  is a new row in an `order_events` log with actor, comment and timestamp. Nothing is overwritten.
- Transient errors are retried; a failure after retries creates **one** manual fallback task for Cloud Ops.
  The error workflow is attached to the main workflow only, so retries inside the sub-workflow don't create duplicate alerts.

## Test results

| # | Scenario | Result |
|---|---|---|
| 1 | Standard EU order, 3 environments | ✅ Approved → activated, 3 subscriptions, 4 notifications |
| 2 | Australian customer, long legal name | ✅ AU account selected, subscription names shortened to 54 characters |
| 3 | DR type "to be confirmed" | ✅ Rejected before approval (see finding 1) |
| 4 | DR type in form ≠ contract | ✅ Rejected before approval: "DR type mismatch" |
| 5 | 4 environments + injected instruction | ✅ Approval form showed the warnings; approved → 4 subscriptions incl. UAT |
| 6 | Simulated cloud API failure | ✅ Three retries, then one manual fallback task with the error and the execution link; no activation |
| 7 | Cloud Ops rejects | ✅ Rejected with a comment; rejected_by_ops event logged, Sales notified  |

**Measured in the test run (simulated orders):** approval to activation, including the billing agreement,
subscriptions and four notifications: **about 0.3 seconds**. Manual touches per order: **2** (upload and approval),
compared with an estimated ten across five teams in the original process.

Validation rules are unit-tested (10 tests):

```
node tests/validate-order.test.js
```

Without Node.js installed, run the same test in Docker:

```
docker run --rm -v "${PWD}:/app" -w /app node:lts node tests/validate-order.test.js
```

## What testing taught me

1. **The AI read "to be confirmed" as "none".** For a contract where the DR option was still to be agreed,
   the model returned DR type "none" instead of "not specified". The order was still stopped by the rules
   (the form said otherwise), but for the wrong reason, and with matching input it could have been activated
   without disaster recovery. I added an explicit prompt rule and keep the contract as a regression test.
2. **Rules caught what people miss:** an Australian contract submitted with region EU was stopped with
   "Region mismatch"; long legal names were shortened automatically for the 60-character limit.
3. **Most defects were integration and configuration, not the model:** branch conditions, column types,
   field mapping between workflows, empty node outputs stopping a branch. Each was found by a test case.
4. **Design changed because of testing:** updating order rows in place proved unreliable in the data tables,
   so status changes became an append-only event log, which is also the better audit trail.
5. **Alerting needs design too:** the first version created four fallback alerts for one failure, one per retry
   of the sub-workflow plus one for the main workflow. Attaching the error workflow only to the main workflow
   gives one actionable task per failed order.
6. **Free-tier reality:** the model occasionally returned HTTP 503 (overloaded); the AI node retries automatically.

## Known limitations

- The manual fallback task does not yet carry the order ID; it links to the failed execution instead.
- Test case 7 (rejection by Cloud Ops) is built but not yet run in the final version.
- All external systems are simulated with n8n data tables; emails are written to a notifications table.
- Free-tier model, fictional data only. Not production-ready by design (see below).

## Screenshots

| Screenshot | |
|---|---|
| Main workflow | ![Workflow](docs/screenshots/01-workflow.png) |
| TC1 – Sales form | ![TC1 Sales form](docs/screenshots/12_Sales%20form.png) |
| TC1 – Form submitted | ![TC1 Form submitted](docs/screenshots/14_Form%20submitted.png) |
| TC1 – AI extraction output | ![TC1 AI output](docs/screenshots/15_AI%20Extract%20Order%20output.png) |
| TC1 – Cloud Ops approval form | ![TC1 Approval](docs/screenshots/13_Approve%20Order%20activation.png) |
| TC2 – Sales form | ![TC2 Sales form](docs/screenshots/22_Sales%20form.png) |
| TC2 – Validation: AU account, shortened names | ![TC2 Validation](docs/screenshots/25_Validate%20Order%20output.png) |
| TC2 – Validation: subscriptions | ![TC2 Validation](docs/screenshots/251_Validate%20Order%20output.png) |
| TC2 – Approval form | ![TC2 Approval](docs/screenshots/23_Approve%20Order%20activation.png) |
| TC3 – Sales form | ![TC3 Sales form](docs/screenshots/32_Sales%20form.png) |
| TC4 – Sales form | ![TC4 Sales form](docs/screenshots/42_Sales%20form.png) |
| TC4 – Validation: DR type mismatch | ![TC4 Validation](docs/screenshots/45_Validate%20Order%20output.png) |
| TC4 – Validation: details | ![TC4 Validation](docs/screenshots/451_Validate%20Order%20output.png) |
| TC5 – Sales form | ![TC5 Sales form](docs/screenshots/52_Sales%20form.png) |
| TC5 – Approval form with warnings | ![TC5 Approval](docs/screenshots/53_Approve%20Order%20activation.png) |
| TC6 – Sales form | ![TC6 Sales form](docs/screenshots/62_Sales%20form.png) |
| TC6 – Approval form | ![TC6 Approval](docs/screenshots/63_Approve%20Order%20activation.png) |
| TC7 – Sales form | ![TC7 Sales form](docs/screenshots/72_Sales%20form.png) |
| TC7 – Rejection by Cloud Ops | ![TC7 Rejection](docs/screenshots/73_Approve%20Order%20activation.png) |
| Order events (audit trail) | ![Order events](docs/screenshots/07-order-events.png) |
| Subscriptions created | ![Subscriptions](docs/screenshots/08-subscriptions.png) |
| Notifications | ![Notifications](docs/screenshots/Notifications.png) |
| Manual fallback task after a failure | ![Fallback](docs/screenshots/09-fallback-task.png) |

## How to run it

1. Run n8n locally with Docker:
   `docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n`
2. Create the five data tables from the CSV files in `data-tables/`
   (orders, order_events, billing_agreements, subscriptions, notifications) and delete the sample rows.
3. Import the three workflows from `workflows/` (workflow menu → Import from file) in this order:
   `A-create-subscription.json`, `B-error-handler.json`, `C-order-to-activation.json`.
   Keep the workflow names, because workflow C calls A by name.
4. Add a Google Gemini API credential (free tier) and select it in the Gemini Chat Model node.
5. In workflow C, open **… → Settings** and select **B – Error handler** as the error workflow
   (leave A without an error workflow).
6. Publish A, B and C (sub-workflows must be published too), open the form's production URL
   and upload a contract from `test-contracts/`. A valid order waits for approval; the approval link
   is in the `notifications` table.

## From prototype to production

| Prototype | Production |
|---|---|
| n8n form | CRM event (closed-won with signed agreement) |
| n8n data tables | ITSM ticket, billing database, event store |
| Wait-form approval | Approval in ITSM / Slack / Teams with SLA reminders |
| Simulated cloud API | Azure / AWS API with a least-privilege service principal |
| Rules in code | Configuration table owned by Cloud Ops |
| Free-tier LLM | Paid model endpoint with data protection terms and an evaluation set |

## Repository

- `workflows/` exported n8n workflows:
  `A-create-subscription.json` (sub-workflow), `B-error-handler.json` (error workflow),
  `C-order-to-activation.json` (main workflow)
- `code/` Code node scripts
- `prompts/` extraction prompt and output schema
- `test-contracts/` fictional signed agreements
- `data-tables/` table structures as CSV (five tables, each with one sample row to delete after import)
- `tests/` unit test for the validation rules
- `docs/screenshots/`

## Built with

n8n (self-hosted, Docker), Google Gemini API (free tier), Structured Output Parser, n8n data tables, Wait-form approval,
Execute Workflow sub-workflow, Error Trigger. Code, tests and documentation developed with **Codex** (AI-assisted development).

All companies, people and data in this repository are fictional.
