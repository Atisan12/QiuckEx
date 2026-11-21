# Backend Documentation

## Payment Links

Payment links are shareable URLs that let a payer complete a payment without
navigating the full app. Each link is bound to a specific amount, recipient
(owner/profile), and expiry timestamp at creation time.

### Link states

| State | Behavior |
| --- | --- |
| `active` | Payer can review the amount and recipient and proceed to sign. |
| `expired` | Signing is disabled. The UI shows the expiry timestamp, the owner/profile route, and a request-again action when supported. |
| `revoked` | Signing is disabled; the link is no longer valid. |

### Expired link recovery

When a payment link has passed its expiry timestamp, the backend reports the
link as `expired` and the client renders a dedicated expired state:

- **No signing CTA.** The signing action is removed entirely for expired links;
the payer cannot attempt a stale payment from the expired view.
- **Localized expiry messaging.** Expiry copy is resolved through the client
i18n layer (no hardcoded English-only strings), so the explanation of what
happened is presented in the payer's locale.
- **Expiry timestamp.** The expired state displays the link's expiry timestamp
so the payer understands when the link stopped being valid.
- **Owner/profile route.** The expired state links back to the owner/profile
route, giving the payer a safe navigation path instead of a stale payment.
- **Request-again action.** Where the capability is supported, the payer can
request a new link. Requesting again never silently changes the amount or
recipient; any new link is created explicitly with the original terms and a
fresh expiry.

### Capability map

| Capability | Active | Expired |
| --- | --- | --- |
| Review amount/recipient | yes | yes |
| Sign payment | yes | no |
| View expiry timestamp | no | yes |
| Navigate to owner/profile | yes | yes |
| Request new link | n/a | yes (when supported) |

### Operational notes

- Expiry is evaluated server-side against the stored expiry timestamp; clients
must not infer expiry from local clocks alone.
- Do not log signing material, secrets, or unnecessary personal data when
handling expired-link requests.
