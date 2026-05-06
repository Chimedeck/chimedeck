# websocket-room-subscription-tenant-escape

## Serveriy (Critical, High, Medium, Low, Warning)

Critical

## Explainnation on the impact

Unauthorized subscription to foreign tenant websocket rooms can expose live board updates, comments, member events, and sensitive operational activity in real time. If event channels include mutation acknowledgements or state snapshots, the same flaw may also facilitate unauthorized data manipulation workflows by giving attackers valid object identifiers and workflow timing signals.

## How to actually exploit the loop hole

1. Authenticate as a regular user in Tenant A and establish a websocket connection.
2. Capture the room subscription frame/payload format used by the client.
3. Replace room or channel identifiers with values from Tenant B (workspace room, board room, card stream, activity feed).
4. Submit the forged subscription while keeping Tenant A credentials unchanged.
5. Observe whether server accepts the subscription and starts pushing Tenant B events.
6. Trigger activity in Tenant B to confirm sustained event delivery.

## Step by step hypothesis to re-produce the loop whole

1. Create Tenant A and Tenant B with separate users and no shared memberships.
2. In Tenant B, keep at least one board active and generate identifiable event markers (new card title, comment text, status transitions).
3. Log in as Tenant A user and open the app websocket connection; capture one legitimate subscribe message.
4. Modify only the room/channel identifier fields to target Tenant B resources.
5. Send the modified subscription frame using the same socket and auth context.
6. Generate additional activity in Tenant B and monitor incoming events on Tenant A connection.
7. Confirm vulnerability if Tenant A receives Tenant B event payloads, metadata, or acknowledgement messages without explicit authorization to Tenant B resources.
