# Tombola-Draw
Tombola Draw is an app for fair lottery drawings. You register all tickets with a mumber series and optionally a color and a letter.
You can register several series of tickets as long as they don't overlap.

Properties:
- Each ticket will never be drawn more than once.
- Each ticket series starts with 1 as the default value, but this can be overrided.
- If you press the Back button (<), you will see the previous winner ticket and a forward button (>) will also be available.
- A previously drawn ticket will be marked with an R in the upper, right corner of the window to make it clear that this is only a repetition.
- Overlapping ticket series will not be registered. Two series are overlapping if they have the same color, the same letter and a common nummer value.
- Every ticket series have a round status indicator. It is orange as long as the series is incomplete. It will be green when everything is OK and red if is overlapping with another ticket series.
- The maximum number of registered tickets is 99 999.
- If you click the menu icon, you can see which ticket series are registered or reset the app. You can also modify the number of seconds the app will use to reveal the next winner ticket.
