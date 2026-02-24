from urllib.parse import urlparse
import httpx
import msal
from bs4 import BeautifulSoup
from app.config import settings


class SharePointService:
    _app: msal.PublicClientApplication | None = None
    _token_cache: msal.SerializableTokenCache = msal.SerializableTokenCache()
    SCOPES = ["https://graph.microsoft.com/Sites.Read.All"]

    @classmethod
    def is_sharepoint_url(cls, url: str) -> bool:
        return ".sharepoint.com" in url.lower()

    @classmethod
    def _get_app(cls) -> msal.PublicClientApplication:
        if cls._app is None:
            if not settings.azure_client_id or not settings.azure_tenant_id:
                raise ValueError(
                    "AZURE_CLIENT_ID and AZURE_TENANT_ID must be set in .env to access SharePoint."
                )
            authority = f"https://login.microsoftonline.com/{settings.azure_tenant_id}"
            cls._app = msal.PublicClientApplication(
                settings.azure_client_id,
                authority=authority,
                token_cache=cls._token_cache,
            )
        return cls._app

    @classmethod
    def _get_token(cls) -> str | None:
        """Try to get a cached token silently."""
        app = cls._get_app()
        accounts = app.get_accounts()
        if accounts:
            result = app.acquire_token_silent(cls.SCOPES, account=accounts[0])
            if result and "access_token" in result:
                return result["access_token"]
        return None

    @classmethod
    def interactive_login(cls) -> str:
        """Open browser for interactive login. Returns access token."""
        app = cls._get_app()
        result = app.acquire_token_interactive(scopes=cls.SCOPES)
        if "access_token" in result:
            return result["access_token"]
        raise RuntimeError(
            f"Authentication failed: {result.get('error_description', result.get('error', 'Unknown'))}"
        )

    @classmethod
    def get_token_or_auth_needed(cls) -> tuple[str | None, bool]:
        """Returns (token, False) if authenticated, or (None, True) if auth is needed."""
        token = cls._get_token()
        if token:
            return token, False
        return None, True

    @classmethod
    def _parse_sharepoint_url(cls, url: str) -> tuple[str, str]:
        """Parse SharePoint URL into (site_hostname_path, relative_path).
        E.g. https://microsoft.sharepoint.com/teams/prss/release
        → site: microsoft.sharepoint.com:/teams/prss, path: /release
        """
        parsed = urlparse(url)
        hostname = parsed.hostname or ""
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]

        if len(path_parts) >= 2 and path_parts[0] in ("teams", "sites"):
            site_path = f"/{path_parts[0]}/{path_parts[1]}"
            relative_path = "/" + "/".join(path_parts[2:]) if len(path_parts) > 2 else "/"
        else:
            site_path = ""
            relative_path = parsed.path or "/"

        site_id_path = f"{hostname}:{site_path}" if site_path else hostname
        return site_id_path, relative_path

    @classmethod
    async def fetch_content(cls, url: str, token: str) -> tuple[str, str]:
        """Fetch SharePoint page content via Microsoft Graph API. Returns (title, text_content)."""
        site_id_path, relative_path = cls._parse_sharepoint_url(url)
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get site ID
            site_resp = await client.get(
                f"https://graph.microsoft.com/v1.0/sites/{site_id_path}",
                headers=headers,
            )
            site_resp.raise_for_status()
            site_data = site_resp.json()
            site_id = site_data["id"]
            site_name = site_data.get("displayName", url)

            # Try to get page content - first list pages
            content_parts = []
            title = site_name

            # Try fetching as a page
            try:
                pages_resp = await client.get(
                    f"https://graph.microsoft.com/v1.0/sites/{site_id}/pages",
                    headers=headers,
                )
                if pages_resp.status_code == 200:
                    pages = pages_resp.json().get("value", [])
                    # If relative_path points to a specific page, find it
                    target_page = relative_path.strip("/").lower()
                    for page in pages:
                        page_name = page.get("name", "").lower().replace(".aspx", "")
                        if target_page and page_name == target_page:
                            # Fetch specific page content
                            page_id = page["id"]
                            page_content_resp = await client.get(
                                f"https://graph.microsoft.com/v1.0/sites/{site_id}/pages/{page_id}/microsoft.graph.sitePage/webParts",
                                headers=headers,
                            )
                            if page_content_resp.status_code == 200:
                                for wp in page_content_resp.json().get("value", []):
                                    inner = wp.get("innerHtml", "")
                                    if inner:
                                        soup = BeautifulSoup(inner, "html.parser")
                                        content_parts.append(soup.get_text(separator="\n", strip=True))
                            title = page.get("title", site_name)
                            break
                    else:
                        # No specific page match — grab all page titles/descriptions
                        for page in pages:
                            desc = page.get("description", "")
                            page_title = page.get("title", "")
                            if page_title:
                                content_parts.append(f"Page: {page_title}")
                            if desc:
                                content_parts.append(desc)
            except Exception:
                pass

            # Also try fetching items from the default document library
            try:
                items_resp = await client.get(
                    f"https://graph.microsoft.com/v1.0/sites/{site_id}/drive/root/children",
                    headers=headers,
                )
                if items_resp.status_code == 200:
                    items = items_resp.json().get("value", [])
                    if items:
                        content_parts.append("\n--- Documents ---")
                        for item in items[:50]:
                            name = item.get("name", "")
                            size = item.get("size", 0)
                            content_parts.append(f"- {name} ({size} bytes)")
            except Exception:
                pass

            if not content_parts:
                # Fallback: at least return site info
                content_parts.append(f"SharePoint Site: {site_name}")
                desc = site_data.get("description", "")
                if desc:
                    content_parts.append(f"Description: {desc}")
                content_parts.append(f"URL: {url}")

            return title, "\n\n".join(content_parts)
