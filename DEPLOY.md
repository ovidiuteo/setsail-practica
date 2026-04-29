# Deploy SetSail Practică pe Vercel

## Metoda 1 — GitHub + Vercel (recomandat)

1. Creați un repo nou pe GitHub (ex: `setsail-practica`)
2. Rulați în terminal:
```
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERUL/setsail-practica.git
git push -u origin main
```
3. Mergeți pe vercel.com → "New Project" → importați repo-ul
4. La "Environment Variables" adăugați:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://tzrwwnenkgzwgocmlaon.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (cheia din .env.local)
5. Click Deploy!

## Metoda 2 — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```
La Environment Variables, adăugați cele două variabile de mai sus.
