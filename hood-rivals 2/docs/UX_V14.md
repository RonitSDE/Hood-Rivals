# v1.4 — island and captain experience

## Included
- World-first layout with more visible terrain, restrained pixel pollen/fireflies and reduced-motion support.
- Inspector and outpost drawers are optional; travel buttons jump to each outpost. My outpost follows the linked faction captain (Emberhold for guests). A manual selection disables the director.
- Pointer pan, pinch zoom, keyboard controls, minimap and responsive controls.
- Living island iframe remains mounted during navigation; simulation/rendering pause when hidden. Refresh still resets the local world. Nothing implies server-persisted autonomous agents.
- Wallet progress: choose wallet, confirm network, sign ownership challenge. No payment for account linking.
- Native accessible onboarding dialog with pixel identity badge, captain ID and three-step setup. Close and resume from the world.
- Captain passport, copy full captain ID, visit outpost, account menu, switch wallet and sign out.
- A fresh wallet cannot reassign an existing linked captain. Existing wallets restore their original account. Signing out deletes the current server session only.

## Developer acceptance path
1. Fresh guest: explore, inspect agent, jump between all three outposts; open profile then return. The same local island must remain.
2. Complete practice and inspect recap/replay. Try room and solo paths.
3. Connect wallet; cancel once, retry, sign challenge. Close setup, resume, name captain, select faction and stance.
4. Reload and restore; copy ID, edit name/faction, visit outpost.
5. Switch to a different wallet and confirm separate profile. Return to original wallet and confirm history remains.
6. Sign out, reconnect, verify the same saved captain returns.
7. Test 390px touch layout on physical iOS/Android wallets and desktop wallet extensions on the public origin.
8. Configure/deploy test contracts and execute real testnet checkout separately. Simulated signing is not a live payment receipt.

## Scope
No contract deployment, token launch, shared world persistence or public Render deployment occurred in this update. Pixel island agents remain rule-based local simulation. Pixel passport is a faction identity badge, not a representation of purchased tactical cosmetics. Existing wallet settings, store readiness gates and economics remain applicable.
