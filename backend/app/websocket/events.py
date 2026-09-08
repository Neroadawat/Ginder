"""WebSocket event names exchanged during a party session."""

# ─── Client → Server ───
# Note: swipes are NOT accepted over the socket. They are recorded exclusively
# through POST /sessions/{id}/swipe, which validates session membership and
# deck membership server-side; the server then broadcasts EVENT_LIKE itself.
# A client-originated swipe event would let anyone broadcast a "like" that was
# never actually persisted.
EVENT_PING = "ping"  # Keep-alive

# ─── Server → Client ───
EVENT_USER_JOINED = "user_joined"  # Someone joined the lobby
EVENT_USER_LEFT = "user_left"  # Someone was kicked or left
EVENT_SESSION_STARTED = "session_started"  # Host started the session
EVENT_LIKE = "like"  # Someone liked a restaurant
EVENT_UNANIMOUS_MATCH = "unanimous_match"  # Everyone liked the same restaurant
EVENT_USER_WAITING = "user_waiting"  # Someone finished their deck
EVENT_TIMER_END = "timer_end"  # Countdown reached zero
EVENT_SPIN_WHEEL = "spin_wheel"  # Wheel candidates, spin starting
EVENT_RESULT = "result"  # Final winning restaurant
EVENT_PONG = "pong"  # Keep-alive reply
EVENT_ERROR = "error"  # Something went wrong

# Note: there is intentionally no early-termination event. Sessions always run
# until every deck is finished or the timer expires (requirement 9.1).
