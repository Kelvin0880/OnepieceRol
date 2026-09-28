# Production runs on Neon Postgres, not the host's own database

Local development uses SQLite while production uses Postgres, with the production schema derived from the same model file at build time. The host's free Postgres deletes itself after 30 days, which would break the promise that expansions never wipe a character's progress, so the database lives on Neon's permanent free tier instead. Every schema change must therefore be additive and pushed to Neon before the code that needs it is deployed.
