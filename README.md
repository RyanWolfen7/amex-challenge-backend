## Order of operations
- initial Look
    - needs
        - auth
            - no env
            - no SSL certs
        - central logging (P1)
        - better error handling
        - basic security
            - rate limmiter
            - TLS/SSL certs
            - XSS
            - CORS configuration
        -performance issues
            - no code splitting
            - no cacher
            - single threaded node

        - ci/cd
- inital calls
    - noticed that ID doesn't seem right for events
    - getEventByID should be its own call
        - if you call this endpoint with an actual id it crashes
            - only can call by event-1 or event-3
    - get userBy ID should be its own call
- Build out my priotity list and current schema
