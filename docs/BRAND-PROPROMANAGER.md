# Design system ProProManager

Estratto dal sito ufficiale **https://affittibreviaroma.com** (dominio alias
`propromanager.com`) — stack shadcn/ui + Tailwind. I token qui sotto sono quelli
reali del brand, non un'interpretazione.

## Logo
`public/logo-propromanager.png` — esagono cremisi con casa in negativo +
lockup "PROPRO" (sans geometrico bold) / "manager" (serif) + ®.

## Colore

Primary **`hsl(346 72% 31%)` = `#881631`** (bordeaux). Favicon: `#B91C3C`.

### Token semantici (light)
```
--background        0 0% 100%
--foreground        222.2 84% 4.9%
--card              0 0% 100%
--primary           346 72% 31%      /* #881631 */
--primary-foreground 0 0% 100%
--secondary         0 0% 96%
--muted             0 0% 96%
--muted-foreground  0 0% 45%
--accent            346 72% 31%
--destructive       0 84.2% 60.2%
--border / --input  214.3 31.8% 91.4%
--ring              222.2 84% 4.9%
--radius            0.5rem
```

### Token semantici (dark)
```
--background        222.2 84% 4.9%
--foreground        210 40% 98%
--secondary/--muted 0 0% 15%
--border/--input    217.2 32.6% 17.5%
--sidebar-background 240 5.9% 10%
```

## Linguaggio visivo del sito
- Fondo chiaro con pattern a puntini sottile.
- Navbar "pill" bianca flottante con ombra morbida.
- Titoli molto pesanti in nero, parola chiave in bordeaux.
- CTA pill bordeaux, ombra `0 10px 20px rgba(200,0,0,.4)` + `inset 0 4px 4px rgba(255,255,255,.4)`.
- Corpo testo grigio muted, raggi generosi.
- Font: stack di sistema (`ui-sans-serif, system-ui`).

## Mappatura stati richiesta sul brand
| Stato | Colore |
|---|---|
| In Attesa | `#D97706` ambra |
| Accettata | `#059669` smeraldo |
| In Corso | `#2563EB` blu |
| Da Verificare | `#7C3AED` viola |
| Completata | `#881631` bordeaux (brand) |
| Cancellata | `#DC2626` rosso |
