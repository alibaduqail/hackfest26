Terra, build **The Hollow Simulator**, a 2D web app for our hackathon team. We want to trigger a crisis in one underground district, watch what happens to the people who live there, then replay it with a solution we build. Someone watching the two runs should be able to point to a neighborhood and explain what changed for its residents.

### The world

In 2087, the surface became unlivable. Two billion people now live in the Hollow, a network of cities built into old mines and subway tunnels. Aging geothermal plants provide power, water is recycled, and communal farms grow food under lamps. The Directorate controls air, communications, and travel between levels. Upper levels get more light, air, and space. Deeper levels are hotter, more crowded, and the first to lose power. Machines still operate above ground. Nobody has returned to the surface in thirty years, and its current condition is disputed.

### What I want to see

Open on a **2D side-view cutaway** of one district. Put a shuttered surface entrance at the top, a well-lit upper level with a clinic and supply depot, a middle level with a lamp farm and lift landing, and a cramped lower neighborhood with homes, a cooling fan, and a drainage pump. Give me one supply cart I can follow from the depot to the lower homes. Make the geography readable enough that I can point to the passage those residents depend on.

Let me click a room, machine, or passage to see what it serves and what it depends on. Show the consequences on the map itself. Lights fade, fan blades stop, water rises against a marked tunnel wall, and the cart waits at a blocked crossing. Drive those changes from the simulation state. Use text or symbols alongside color so the map reads well on a projector.

### The first playable incident

Start paused just before a lower-level power failure. When the feeder trips, the upper clinic stays lit. Down below, one charged backup battery can run either the fan or the pump. By default it runs the fan. With the pump off, water rises every simulated minute. Once it reaches a marked threshold, the only depot passage closes and the next cart waits.

Let me switch backup power to the pump. An early switch keeps the passage open but leaves residents without cooling. A late switch has to drain the tunnel before the cart can cross. Running either machine consumes charge. Put the map connections, households, battery capacity, water rates, and timed failures in one editable scenario file. Label these as fictional test inputs.

### How our team plugs in a solution

Keep the simulation rules independent of the graphics. Give places and machines stable IDs. Expose two documented calls, such as `observe()` to read timestamped district reports and `act({ type: "assignBackup", targetId: "deep-pump" })` to request an action. Manual controls and our future solution should follow the same rules. Include one replaceable example that requests pump power when a reported water level starts rising.

Give the person running the experiment a switch to cut district communications. The cutaway can still show the water rising. In the reports our solution receives, the last reading keeps its original timestamp and is marked stale. A location that has never reported shows “unknown.”

### How we’ll know it works

Give us Play, Pause, Step one minute, Fast-forward, and Reset. Compare the default response with our intervention from the same starting state through the same ending minute. Repeating the same actions should reproduce the same results. Show **minutes without cooling**, **crates actually delivered**, and **household-minutes cut off from the depot**, broken down by level. Twelve households cut off for five minutes should count as 60 household-minutes. Let us trace each result to events on the timeline.

Deliver a locally runnable web app, the editable scenario, and a short README showing how to start it and connect a solution. A teammate should be able to demonstrate the blackout, rewind to the start, change one decision, and explain the tradeoff in under two minutes.

The setting comes from the [Patriot HackFest “Life underground” brief](https://docs.google.com/document/d/1sz_UdwRzvyL1dVbcbqLnUdJwVHvOUWARg4B79VmKgaE/edit?tab=t.g3ixdrcdfya4).
