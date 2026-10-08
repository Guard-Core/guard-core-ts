# Security Policy

## Supported Versions

| Package | Version | Supported |
| --- | --- | --- |
| @guardcore/core | 0.x | :white_check_mark: |
| @guardcore/express | 0.x | :white_check_mark: |
| @guardcore/fastify | 0.x | :white_check_mark: |
| @guardcore/nestjs | 0.x | :white_check_mark: |
| @guardcore/hono | 0.x | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them through [GitHub Security Advisories](https://github.com/Guard-Core/guard-core-ts/security/advisories/new).

You will receive an acknowledgment within **48 hours** from [@rennf93](https://github.com/rennf93).

When reporting, please include:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Security Best Practices

When deploying applications using @guardcore packages:

- **API tokens**: Store all tokens (IPInfo, Redis, etc.) in environment variables, never in source code
- **IP whitelisting**: Use `whitelistedIPs` to restrict access to known IPs for admin endpoints
- **Rate limiting**: Always enable rate limiting in production with appropriate thresholds
- **HTTPS enforcement**: Enable `enforceHttps` in production environments
- **CORS configuration**: Restrict allowed origins, methods, and headers to the minimum required
- **Redis security**: Use TLS connections, authentication, and network isolation for Redis instances
- **Security headers**: Use the default security headers or configure stricter values
- **Request size limits**: Set appropriate `maxRequestSize` and `contentType` restrictions
- **Cloud provider blocking**: Enable cloud provider IP blocking if your API should not be accessed from cloud infrastructure

## Security Features

@guardcore provides the following security features:

- IP-based access control (whitelist/blacklist)
- Rate limiting (per-IP, per-endpoint, with Redis-backed distributed state)
- Suspicious pattern detection (SQL injection, XSS, path traversal, command injection, etc.)
- Cloud provider IP blocking (AWS, GCP, Azure, Oracle, DigitalOcean)
- GeoIP-based filtering
- HTTPS enforcement and redirection
- Security header injection (HSTS, CSP, X-Frame-Options, etc.)
- Request size and content-type validation
- User-agent filtering
- Referrer validation
- Authentication header enforcement
- Time-window-based access control
- Custom validator support
- Behavioral rule processing

## Threat Model

@guardcore is designed to mitigate the following threats at the application middleware layer:

| Threat | Mitigation |
| --- | --- |
| Brute force attacks | Rate limiting, IP banning after threshold |
| DDoS / volumetric abuse | Rate limiting, cloud provider blocking, IP blacklisting |
| Web scraping | User-agent filtering, rate limiting, behavioral rules |
| Reconnaissance / scanning | Suspicious pattern detection, path traversal blocking |
| Penetration attempts | SQL injection, XSS, command injection pattern detection |
| Credential stuffing | Rate limiting, authentication header enforcement |
| API abuse | Per-endpoint rate limits, time-window restrictions |

## Responsible Disclosure

We follow a responsible disclosure process:

1. Reporter submits vulnerability via GitHub Security Advisory
2. Maintainer acknowledges within 48 hours
3. Maintainer investigates and develops a fix
4. Fix is reviewed and tested
5. Security advisory is published with the fix release
6. Reporter is credited (unless they prefer anonymity)

We kindly ask that you:

- Allow reasonable time for the vulnerability to be fixed before public disclosure
- Make a good faith effort to avoid privacy violations, data destruction, or service disruption
- Do not exploit the vulnerability beyond what is necessary to demonstrate it
