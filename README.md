
# Tombola Draw

_Tombola Draw_ is an app for fair lottery drawings. You register all the valid tickets with a number interval, a ticket color and optionally a letter. You can register multiple, non-overlapping series of tickets.

<div align ="center">
  <img src="images/top-hat-001-ap.png" alt="Tombola Draw Icon" width="80px">
</div>

## Properties

_Tombola Draw_ has the following properties:

- A ticket will never be drawn more than once.
- Overlapping ticket series will not be registered. A conflict occurs when two series share the same color, letter, and at least one matching ticket number.
- Every ticket series has a status indicator.
  - 🔴 **Red**: The series is overlapping with another ticket series
  - 🟠 **Orange**: The series is incompletely specified
  - 🟢 **Green**: The series is valid
- Each ticket series starts with 1 as the default value, but this can be overridden.
- Maximum number of registered tickets is **99,999**.
- To complete the registration mode you have to press the Ready button.
- If you press either the `Draw` button, the `Space` key or the `Enter` key when the app is in ready or drawing mode, a new ticket will be drawn.
- You can traverse the list of previous winner tickets by pressing the screen buttons &#9664; and &#9654; or the corresponding navigation keys.
- A previously drawn ticket is marked with an **R** in the top-right corner to make it clear that it is a repetition.
- You can click the menu icon in the top-left corner to reset the app, view registered ticket series or adjust the suspension time.
- The suspension time is the waiting time from the `Draw` button is pressed to the winner ticket is actually revealed.
