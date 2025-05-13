import express from 'express';
import httpProxy from 'http-proxy';
import cookieParser from 'cookie-parser';
import { Issuer, Strategy } from 'openid-client'; // Changed to named import
import session from 'express-session';
import passport from 'passport';
import MemoryStore from 'memorystore';

import 'dotenv/config'

// Discover the oidc config
const keycloakIssuer = await Issuer.discover(process.env.KEYCLOAK_URL)

// initiate proxies
const apiProxy = httpProxy.createProxyServer({
  target: process.env.KONG_ADMIN_API,
  changeOrigin: true,
});

const frontendProxy = httpProxy.createProxyServer({
  target:  process.env.KONG_ADMIN_UI,
  changeOrigin: true,
});

const app = express();
const port = process.env.APP_POR || 9000;

// initiate the keycloak client
const client = new keycloakIssuer.Client({
  client_id: process.env.KEYCLOAK_CLIENT_ID,
  client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
  redirect_uris: [`${process.env.APP_URL}/callback`],
  post_logout_redirect_uris: [`${process.env.APP_URL}/callback/logout`],
  response_types: ['code'],
});

app.use(cookieParser());

app.use(session({
  secret: process.env.APP_SECRET,
  resave: false,
  saveUninitialized: true,
  store: new (MemoryStore(session))({
    checkPeriod: 24 * 60 * 60 * 1000, // 24 hour
  }),
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 2 * 60 * 60 * 1000, // 2 hour
  },
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(passport.authenticate('session'));

passport.use('oidc', new Strategy({client}, (tokenSet, _, done) => {
    return done(null, {
      id_token: tokenSet.id_token,
      ...tokenSet.claims()
    });
  })
)

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  res.redirect('/auth');
};

app.get('/auth', (req, res, next) => {
  if (req.user && req.session) {
    next();
  }

  passport.authenticate('oidc')(req, res, next)
});

app.get('/logout', (req, res, next) => {
  if (req.user && req.session) {
    res.redirect(client.endSessionUrl({
      id_token_hint: req.user.id_token,
    }));
  }

  next();
});

app.get('/callback/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

app.get('/callback',
  passport.authenticate('oidc', {
    successRedirect: '/',
    failureRedirect: '/',
  })
);

app.use('/api', isAuthenticated,  (req, res) => {
  console.log(`${req.user.email} accessing ${req.path}`);
  apiProxy.web(req, res, {}, (e) => {
    console.error("Api Proxy Error:", e);
    res.status(500).send({ error: 'Proxy error' });
  });
});

app.use('/', isAuthenticated, (req, res) => {
  frontendProxy.web(req, res, {}, (e) => {
    console.error("Frontend Proxy Error:", e);
    res.status(500).send({ error: 'Proxy error' });
  });
});

app.listen(port, () => {
  console.log(`Proxy server with authentication listening at ${process.env.APP_URL} (local port: ${port})`);
});
