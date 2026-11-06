# City Dispatch

Open **Explore Common Ground → City Dispatch**, **Tools → City Dispatch**, or **Menu → City Dispatch · quests & dailies** on a phone.

## The play loop

Pick a job, follow its walking directions, and approach the marked resident. Click or tap the tracked objective to help. Stay near the resident during the short interaction. Leaving, opening the board, or pausing cancels the local interaction; start it again on return. Completed objectives reveal the next stop. Only one job is tracked at a time; changing jobs preserves progress.

Three permanent stories introduce Mara the gardener, Ivo the radio technician, and Noor the community host. They contain 3–4 ordered objectives and pay 80–100 credits on completion. These are authored narrative errands with timed interactions, not new repair or gardening simulation systems. Their outcomes are personal story progress; they do not modify shared buildings or terrain.

Three daily jobs rotate from a seven-job pool at **00:00 UTC**. Tasks include seed deliveries, soundchecks, gallery care, book returns, arcade checks, invitation deliveries, and tending propagation trays. Each pays 55–70 credits once per account per day. Unfinished daily jobs expire at reset. Permanent story progress remains.

## Persistence and authority

Online progress is account-wide across city rooms. A dedicated database record stores ordered progress and completed-job count. Reward payment and completion commit in the same transaction. The server validates the live city session, player health, job identity, step number, position, elapsed interaction time and completion status. It uses the existing client-reported/server-validated city pose; it does not introduce a fully authoritative movement simulation. Expired jobs and duplicate completion requests cannot grant rewards.

Only explicit board loads, midnight refreshes, and job actions use the network. There is no frame-by-frame quest polling or additional save per placed block. The existing inventory receives the authoritative wallet response; credits are not re-submitted through the general earning endpoint.

Solo progress is local to this browser/device and city seed. Save the game normally to preserve its wallet. Solo progress and credits are not transferred to the online account. Device-clock daily rotation is used offline; online rotation uses server time.

## Activity and performance

Street gatherings start looking for a suitable location after eight seconds of active play. After an event ends, another appears after roughly 35–65 seconds, subject to open ground, visibility and gameplay state. Existing buskers, markets, dance gatherings, processions and speakers are reused. Automatic brawls are excluded around Common Ground and the building yard. These ambient events are local presentation; they are not synchronized multiplayer encounters.

One street event runs at a time, retaining the existing graphics-tier crowd scaling. The tracked quest adds at most one named resident within 65 metres; it is disposed on job, scene or world changes. There are no new lights or shadow maps. The quest display replaces the existing goal/directions area while tracked. Mobile controls retain 44-pixel targets and a scrollable single-column board.

## Validation and deployment

`city-dispatch.test.cjs` covers ordering, proximity, timing, duplicate rewards, transaction rollback, account isolation, reopening the service, and UTC rollover. `city-dispatch-browser.test.cjs` exercises an online three-step quest through the UI, NPC appearance, wallet payment, reload, responsive layouts, and street-event disposal. `city-dispatch-solo-mobile.test.cjs` verifies touch entry points, a solo daily job, save/reload, and the directory link. Existing server regressions also apply.

The server packaging lists include `city-dispatch.cjs`; public asset packaging includes both new browser modules. Deploy the server and client together. The repository’s hosted Render configuration has automatic deployment disabled, so pushing this change alone does not update that hosted game.
