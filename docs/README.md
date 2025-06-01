
# TombolaDraw

Tombola Draw is an app for fair lottery drawings. You register all the valid tickets with a number interval, a ticket color and optionally a letter. You can register multiple, non-overlapping series of tickets.

<div align ="center">
  <img src="images\top-hat-001-ap.png" alt="Tombola Draw Icon" width="80px">
</div>

## Properties

Tombola Draw have the following properties:

- A ticket will never be drawn more than once.
- Overlapping ticket series are not accepted. Two or more series are overlapping if they share the same  color, the same letter and at least one common number value.
- Each ticket series starts with 1 as the default value, but this can be overrided.
- Every ticket series have a status indicator. It is orange when the specification of the series is incomplete. It is green when everything is OK and red if it is overlapping with another ticket series.
- The number of registered tickets is limited to 99 999.
- To complete the registration mode you have to press the Ready button
- If you press either the Draw button, the \<Space\> key or the \<Enter\> key when the app is in drawing mode, a new ticket will be drawn.
- If you press the Back button (<) or the Forward button (>), you will see either the previous or the following winner ticket.
- A previously drawn ticket will allways be marked with an **R** in the upper, right corner of the window to make it clear that this is a repetition and not new, valid winner.
- If you click the menu icon in the top, left corner, you can review the registered ticket series or reset the app. You can also change the number of seconds the app will be waiting before revealing the next, chosen winner ticket (the disclosure time).

