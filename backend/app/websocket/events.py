"""WebSocket event types and payloads."""

# ─── Event Names ───
# Client → Server
EVENT_SWIPE = "swipe"                     # User swiped on a restaurant
EVENT_PING = "ping"                       # Keep-alive ping

# Server → Client
EVENT_USER_JOINED = "user_joined"         # A user joined the lobby
EVENT_USER_LEFT = "user_left"             # A user was kicked or left
EVENT_SESSION_STARTED = "session_started" # Host started the session
EVENT_LIKE = "like"                       # Someone liked a restaurant
EVENT_UNANIMOUS_MATCH = "unanimous_match" # All users liked the same restaurant
EVENT_TIMER_END = "timer_end"             # Session timer expired
EVENT_RESULT = "result"                   # Final result (majority/spin wheel)
EVENT_SPIN_WHEEL = "spin_wheel"           # Spin wheel animation data
EVENT_EARLY_TERMINATION = "early_termination"  # No unanimous match possible
EVENT_USER_DONE = "user_done"             # A user finished swiping
EVENT_PONG = "pong"                       # Keep-alive response
EVENT_ERROR = "error"                     # Error message
