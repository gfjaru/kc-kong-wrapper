# kc-kong-wrapper

Keycloak Kong Wrapper, wrap the Admin UI with Keycloak OIDC Auth (Basic OIDC in general), with this you'll able to log any interaction in the Admin UI from the http request, but still limited to no feature restriction, only access restriction.

## Running

Copy the `.env.example` to `.env`, match the value with yours.

Then run the service:

```
npm i
npm run start
```

## Kong Configuration

Need some changes to `kong.conf`, adjust `admin_gui_api_url` and adjust `admin_gui_url` to this service.

Example:
```
admin_gui_api_url=https://this-app/api
admin_gui_url=https://this-app
```
