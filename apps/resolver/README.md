# Resolver

Redirects ARK requests to their destinations

## Test requests

    # Redirects an ARK request to its destination
    curl -iL http://localhost:3000/ark:/27023/000074a6158155ef16efee74ea0ae0d5

    # Fetch the rules for use by e.g. web crawlers
    curl -iL http://localhost:3000/robots.txt
