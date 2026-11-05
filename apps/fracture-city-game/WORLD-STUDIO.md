# World Studio

Open **Tools → World Studio**, **F4**, or **Menu → World Studio** on a phone.

## Art direction and smoothness

Four saved personal looks—City original, Amber cinema, Moonlit silver, Garden dream—plus shadow/highlight colors, brightness, film grain and vignette. Brightness works at all quality settings; film color, grain and vignette controls use the existing composite pass at Balanced or higher. No extra render pass or point light is added. Automatic graphics remains available, and manually chosen quality remains locked.

Remote residents turn smoothly across the angle wrap instead of snapping. Their frame loop reuses its target vector and avoids serializing wardrobe data every frame. Stationary clients send a position heartbeat once per second instead of ten identical requests per second; movement and camera turns still send at up to 10 Hz. Failed pose requests back off for a second. Existing stream reconnection and movement pausing remain in place.

## God mode

Solo worlds allow god mode. Online, the server authorizes accounts in `OWNER_USERNAMES`, or the persistent creator of a private city. The temporary lobby host does not inherit creator privileges. Public-city access is never granted to the first person who joins.

God mode supplies invulnerability, flight and unlimited workshop blocks in the owner's plot. Plot size and door limits still apply. Shared furniture continues to use the existing inventory system. PvP is disabled while god mode is enabled.

Fly with normal movement, Space to rise, C or Control to descend, and Shift to accelerate. Phones use Rise and a dedicated Down button. Returning to ground or leaving god mode restores the entry position. Server checkpoints store that safe position while flying. God mode is not persisted across a server restart, and solo saves require explicitly re-enabling it.

## Shared terrain editing

Enable **World brush**, choose a material and a 1-, 3- or 5-block-wide brush. Place paints and Mine erases. Aim at a surface and use Mark A / Mark B to select a box, then Fill box or Erase box. Undo and Redo also work through the existing build shortcuts. Box operations are limited to 4,096 cells and a world to 20,000 overrides. Voxel terrain is 64 metres high; creator flight reaches 400 metres.

These are persistent voxel-terrain tools, not a mesh editor. Procedural decorative meshes and the megastructure's mesh architecture are not individually selectable. The building yard retains its existing plot ownership, inventory, and door tools rather than having two competing edit systems.

World edits reuse the durable batched save queue: immediate local changes, idle coalescing, one request at a time, local draft recovery and explicit conflict resolution. Save now and ordinary game saves wait for the editing queue. Changes synchronize to all residents and survive chunk unloading and server restart. Solo edits are scoped to the saved world's seed. Reopening the same save restores them; creating a new world creates a separate editing layer.

## Moderation and deployment

The Players & server panel lists residents and bans. **Remove** ends a current session; **Ban** also prevents rejoining; **Allow return** removes the ban. Owner accounts are protected. The API checks authorization independently of the interface, and stores an audit entry for world saves and moderation actions.

Online owner access uses the existing `OWNER_USERNAMES` setting (comma-separated login usernames, not display names). Configure it on the hosted server if it has not already been set. The repository's Render configuration has automatic deployment disabled, so the hosted server must be redeployed for these new endpoints and assets. No live account roles, saves or hosted configuration were changed by this update.

## Verification

Owner/guest integration tests cover forbidden actions, revision conflicts, material/plot protection, shared edits, brush placement, undo/redo, chunk regeneration, offline save restoration, style persistence, flight/invulnerability, safe return, banning/unbanning and server restart. Private-owner tests verify host transfer grants no privileges, free plot blocks need authorization, and flying saves a safe ground position. Existing server authority, phone interaction, streaming budget and save-queue regressions are also checked.
