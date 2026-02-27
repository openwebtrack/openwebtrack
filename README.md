# OpenWebTrack

A free and open-source website analytics platform.

<img src="./.github/preview.png" alt="OpenWebTrack Preview" width="800" />

### Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/openwebtrack/openwebtrack/refs/heads/main/install.sh | sudo sh
```

<details>
<summary>or use compose.yml file:</summary>

```yml
services:
    app:
        image: ghcr.io/openwebtrack/openwebtrack:latest
        container_name: openwebtrack
        restart: unless-stopped
        ports:
            - 8424:8424
        environment:
            - DATABASE_URL=postgres://postgres:{STRONG_PASSWORD}@db:5432/openwebtrack
            - ORIGIN=http://localhost:8424
            - AUTH_SECRET={STRONG_SECRET}
            - DISABLE_REGISTER=false
            # - CRON_SECRET={String} - For weekly summary emails
            # - SENDER_EMAIL=openwebtrack@yourdomain.com - To enable notifications set your email and preferred email provider
            # - RESEND_API_KEY={String}
            # - MAILEROO_API_KEY={String}
            # - SMTP_HOST=smtp.example.com
            # - SMTP_PORT=587
            # - SMTP_USER={String}
            # - SMTP_PASS={String}
        depends_on:
            - db

    db:
        image: postgres:17-alpine
        container_name: openwebtrack-db
        restart: unless-stopped
        ports:
            - 5432:5432
        environment:
            - POSTGRES_USER=postgres
            - POSTGRES_PASSWORD={STRONG_PASSWORD}
            - POSTGRES_DB=openwebtrack
        volumes:
            - postgres_data:/var/lib/postgresql/data

    # cron: Enable for weekly summary emails
    #     image: alpine:latest
    #     command: >
    #     sh -c "echo '0 9 * * 1 curl -s -H \"Authorization: Bearer ${CRON_SECRET}\" http://app:8424/api/cron/weekly-summary' > /etc/crontabs/root && crond -f -L /dev/stdout"
    #     depends_on:
    #     - app
volumes:
    postgres_data:
```

</details>

<br />

<p>
  <a href="https://railway.com/deploy/c0cdXL?referralCode=ewDp_s&utm_medium=integration&utm_source=template&utm_campaign=generic">
    <img src="https://railway.com/button.svg" alt="Deploy on Railway">
  </a>
</p>

## Features

### Analytics & Insights

- **Real-time Traffic Monitoring**: Watch your visitors in real-time.
- **Detailed Pageviews**: Track URLs, titles, and referrers.
- **Session Recording**: Monitor session duration and activity.
- **Custom Events**: Track specific user interactions (clicks, signups, etc.).
- **Geolocation Data**: See where your users are coming from (Country, Region, City).
- **Device & Tech Specs**: Analyze Browsers, OS, Device Types, and Screen Sizes.
- **UTM Tracking**: Measure campaign performance with automatic UTM parameter extraction.
- **Traffic Spike Alerts**: Get instant notifications when your website experiences unusual traffic spikes.

### Notifications & Alerts

- **Weekly Summary**: Receive automated weekly email reports with key analytics metrics.
- **Traffic Spike Detection**: Configure thresholds to get notified when visitor counts exceed expectations.
- **Multi-Provider Support**: Send notifications via Resend, Maileroo, or custom SMTP servers.

### Visitor Intelligence

- **Visitor Profiles**: Track individual visitor journeys.
- **Retention Metrics**: "First seen" and "Last seen" tracking.
- **Auto-generated Identities**: Friendly names and avatars for anonymous visitors.

### Management & Tools

- **Multi-Website Support**: Manage all your projects from a single dashboard.
- **Team Collaboration**: Invite team members to view analytics.
- **Data Export/Import**: Full ownership of your data with easy export options.
- **Filtering**: Deep dive into data with filters (Date, Device, Location, etc.).

## Contributing

We welcome contributions! Please check our [Contributing Guidelines](CONTRIBUTING.md) for details on how to report bugs, request features, and submit pull requests.

## License

See [LICENSE](LICENSE) for full details.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=openwebtrack/openwebtrack&type=date&legend=top-left&r=1)](https://www.star-history.com/#openwebtrack/openwebtrack&type=date&legend=top-left)
