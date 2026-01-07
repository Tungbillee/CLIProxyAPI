# CLI Proxy API - Quick Reference Guide

## Quick Start Commands

```bash
# Clone & Setup
git clone https://github.com/router-for-me/CLIProxyAPI.git
cd CLIProxyAPI

# Copy config
cp config.example.yaml config.yaml

# Run (Linux/macOS)
./docker-build.sh
# Select option 1 or 2

# Run (Windows)
.\docker-build.ps1

# Or direct docker-compose
docker compose up -d
```

## Configuration Checklist

- [ ] Copy `config.example.yaml` to `config.yaml`
- [ ] Set `api-keys` in config
- [ ] Configure provider credentials (gemini-api-key, claude-api-key, etc.)
- [ ] Set `auth-dir` (default: ~/.cli-proxy-api)
- [ ] Configure `remote-management.secret-key` for management API
- [ ] Set port (default: 8317)
- [ ] For TLS: provide `tls.cert` and `tls.key`

## Configuration By Provider

### Gemini (API Key)
```yaml
gemini-api-key:
  - api-key: "AIzaSy..."
    models:
      - name: "gemini-2.5-flash"
        alias: "gemini-flash"
```

### Claude (API Key)
```yaml
claude-api-key:
  - api-key: "sk-ant-..."
    models:
      - name: "claude-3-5-sonnet-20241022"
        alias: "claude-sonnet"
```

### OpenAI/Codex (API Key)
```yaml
codex-api-key:
  - api-key: "sk-atSM..."
    models:
      - name: "gpt-5-codex"
        alias: "codex-latest"
```

### Custom OpenAI-Compatible (e.g., OpenRouter)
```yaml
openai-compatibility:
  - name: "openrouter"
    base-url: "https://openrouter.ai/api/v1"
    api-key-entries:
      - api-key: "sk-or-v1-..."
```

## Port Mapping (Docker)

| Port | Service |
|------|---------|
| 8317 | Main API |
| 8085 | Management API / Control Panel |
| 1455 | WebSocket / Additional |
| 54545 | Legacy / Auxiliary |
| 51121 | Legacy / Auxiliary |
| 11451 | Legacy / Auxiliary |

## Key Files

| File | Purpose |
|------|---------|
| `config.example.yaml` | Configuration template (267 lines) |
| `.env.example` | Environment variables for remote storage |
| `Dockerfile` | Multi-stage Docker build |
| `docker-compose.yml` | Container orchestration |
| `docker-build.sh` | Build script (Linux/macOS) |
| `docker-build.ps1` | Build script (Windows) |
| `go.mod` / `go.sum` | Go dependencies (1.24) |
| `docs/sdk-*.md` | SDK documentation |

## Management API

**Enable in config:**
```yaml
remote-management:
  secret-key: "your-secure-key"
  allow-remote: false  # Keep localhost only
```

**Use:**
```bash
curl -H "X-Management-Key: your-secure-key" \
     http://localhost:8317/v0/management/debug

# Toggle request logging
curl -X PUT -H "X-Management-Key: your-secure-key" \
     http://localhost:8317/v0/management/request-log

# Export usage stats
curl -H "X-Management-Key: your-secure-key" \
     http://localhost:8317/v0/management/usage/export
```

## Dependencies Summary

**Go Version:** 1.24.0

**Key Libraries:**
- Gin (HTTP framework)
- WebSocket (gorilla)
- PostgreSQL driver (jackc/pgx)
- S3 storage (minio)
- Git operations (go-git)
- YAML config (yaml.v3)
- OAuth2 (golang.org/x/oauth2)

**Total:** 76 dependencies

## Troubleshooting

### Port Already in Use
```yaml
port: 9999  # Change in config.yaml
```

### API Keys Not Working
- Check `api-keys` list in config
- Verify credentials in `auth-dir` (default: ~/.cli-proxy-api)
- Check provider-specific config (gemini-api-key, claude-api-key, etc.)

### Models Not Showing
```bash
curl http://localhost:8317/v1/models
```
- Verify provider credentials
- Check `excluded-models` settings
- Ensure model names are correct

### Logs
```bash
docker compose logs -f cli-proxy-api
docker compose logs -f  # All services
```

### Health Check
```bash
curl http://localhost:8317/v1/models
# Should return model list with HTTP 200
```

## Performance Settings

For high-concurrency deployments:
```yaml
commercial-mode: true           # Reduce memory overhead
logging-to-file: true           # File instead of stdout
logs-max-total-size-mb: 500     # Rotate logs
usage-statistics-enabled: false # Disable if not needed

# Streaming optimization
streaming:
  keepalive-seconds: 15
  bootstrap-retries: 1
```

## Load Balancing

**Round-robin (default):**
```yaml
routing:
  strategy: "round-robin"
```

**Quota-based auto-switching:**
```yaml
quota-exceeded:
  switch-project: true           # Auto-switch project
  switch-preview-model: true     # Auto-switch preview
```

## Amp CLI Integration

```yaml
ampcode:
  upstream-url: "https://ampcode.com"
  upstream-api-key: "your-amp-key"
  
  # Model mapping (unavailable → available)
  model-mappings:
    - from: "claude-opus-4-5-20251101"
      to: "gemini-claude-opus-4-5-thinking"
```

## OAuth Support

Providers with OAuth:
- Claude Code (claude-api-key)
- OpenAI Codex (codex-api-key)
- Gemini CLI (gemini-api-key)
- Qwen Code (qwen)
- iFlow (iflow)

Configure OAuth credentials in `auth-dir`:
```
~/.cli-proxy-api/
├── gemini.json
├── claude.json
├── codex.json
└── ...
```

## SDK Usage Example

```go
import "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy"

cfg, _ := config.LoadConfig("config.yaml")
svc, _ := cliproxy.NewBuilder().
    WithConfig(cfg).
    WithConfigPath("config.yaml").
    Build()

ctx, _ := context.WithCancel(context.Background())
svc.Run(ctx)  // Handles hot reload & shutdown
```

## Useful Links

- **Official Docs:** https://help.router-for.me/
- **Management API:** https://help.router-for.me/management/api
- **GitHub:** https://github.com/router-for-me/CLIProxyAPI
- **Control Panel:** https://github.com/router-for-me/Cli-Proxy-API-Management-Center

## File Locations

After startup:
```
project-root/
├── config.yaml              # Your configuration
├── auths/                   # OAuth credentials
│   ├── gemini.json
│   ├── claude.json
│   └── ...
├── logs/                    # Application logs
│   ├── app.log
│   └── requests.log
└── .cli-proxy-api/          # Default auth directory
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Connection refused" | Check if container is running: `docker compose ps` |
| "Invalid API key" | Verify key format & provider credentials |
| "Model not found" | Check excluded-models & aliases in config |
| "Quota exceeded" | Use quota-exceeded auto-switching settings |
| "OAuth token expired" | Re-authenticate or check refresh logic |
| "Port conflict" | Change port in config.yaml |
| "Memory usage high" | Enable `commercial-mode: true` |
| "Slow responses" | Check network proxy, enable request logging |

## Regex for Excluded Models

Supported patterns:
```
- "exact-model-name"      # Exact match
- "prefix-*"              # Prefix match
- "*-suffix"              # Suffix match
- "*substring*"           # Substring match
```

## Deployment Best Practices

1. **Use HTTPS in production:**
   ```yaml
   tls:
     enable: true
     cert: "/path/to/cert.pem"
     key: "/path/to/key.pem"
   ```

2. **Secure management API:**
   ```yaml
   remote-management:
     allow-remote: false  # Localhost only
     secret-key: "strong-random-key"
   ```

3. **Enable monitoring:**
   ```yaml
   usage-statistics-enabled: true
   logging-to-file: true
   ```

4. **Use environment variables:**
   ```bash
   # .env file
   MANAGEMENT_PASSWORD=secure-password
   ```

5. **Multi-instance with shared storage:**
   - PostgreSQL for auth storage
   - Git-backed config
   - S3/Object storage for tokens

---

**Last Updated:** 2026-01-03  
**For detailed info:** See `cli-proxy-api-analysis-260103.md`

