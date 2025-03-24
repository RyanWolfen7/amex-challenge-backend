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
- Updated JSON with needed tools and refactored
- updated logger
    - found that getEvents has a fetch error that wasn't caught with initial errors
    - installed pino-pretty as dev dep
    - changed object to print well
    - added error handling
- refactored routs
    - registered routes
    - migrated routs
    - Look into refactoring one later (endpoint cant be changed so i'm going to try concurrant threads)