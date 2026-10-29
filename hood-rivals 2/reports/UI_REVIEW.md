# UI review — v1.3

Reviewed headless Chromium at desktop1440×1000 and touch-emulated390×844. The living island renders pixel isometric art; the separate tactical game renders a real Three.js canvas. Both are interactive; they are not the same persistent world.

Validated: new first-visit hierarchy; local-world label; searchable role filters (guard search4/15); guided practice step changes after a legal scout order; real event recap; Armory world preview; accessible native wallet picker cancellation; mobile page width stays390px. Screenshots were used internally to correct hero sizing and mobile map/control layout.

The browser world directory pauses simulation while browsing, selected-agent follow disables the director, mobile detail panels avoid a stacked side-panel layout, and hidden tabs skip world animation work. Initial Three.js loading is deferred until needed.

Remaining: physical-device touch/camera ergonomics and frame-rate profiling, screen-reader testing, native share support, live QR pairing, real wallet network/account change behavior and public-host long-session testing. Do not advertise production capacity based on these checks.
