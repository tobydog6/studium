# Google sign-in and workbook decks: one-time setup

Studium has its own Supabase project, Studium (`ircgijvxzcxmcnyugdvm`). Its tables are all `studium_*`. Do these once, in this order. Sign in to Google Cloud as **samquinn2009@gmail.com**.

## 1. Supabase: the tables

Supabase → the Studium project → **SQL Editor** → New query → paste all of `docs/supabase.sql` → **Run**.
It makes the `studium_*` tables, their permissions, and a private storage bucket called `studium-workbooks`.
It is safe to run again later.

## 2. Google Cloud: the login client

At console.cloud.google.com:

1. Make a project called **Studium** (top-left project picker → New project).
2. **APIs & Services → Library**: enable **Google Drive API** and **Google Slides API**.
3. **Google Auth Platform** (or "OAuth consent screen"):
   - **Branding**: app name *Studium*, your support email, authorised domains `studium.nz` and `supabase.co`.
   - **Audience**: External.
   - **Data access → Add scopes**: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`,
     `.../auth/drive.file`. All four are "non-sensitive", so Google doesn't make you go through app review.
   - **Audience → Publish app** so it says *In production*. This matters: while it's in *Testing*, only listed
     test users can sign in, and the Drive permission stops working after 7 days.
4. **Clients → Create client → Web application**, name *Studium*:
   - Authorised JavaScript origins: `https://studium.nz`
   - Authorised redirect URIs (both):
     - `https://ircgijvxzcxmcnyugdvm.supabase.co/auth/v1/callback`
     - `https://ircgijvxzcxmcnyugdvm.supabase.co/functions/v1/studium-drive`
   - Copy the **Client ID** and **Client secret**.

## 3. Supabase: switch Google on

1. **Authentication → Sign In / Providers → Google**: enable, paste the Client ID and Client secret, save.
2. **Authentication → URL Configuration**:
   - Site URL: `https://studium.nz`
   - Redirect URLs: add `https://studium.nz/**` (and `http://localhost:*/**` for testing on your own computer).
3. **Edge Functions → Secrets**: add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (the same two values).

## 4. Supabase: the deck builder function

Either way works:

- **Dashboard**: Edge Functions → Deploy a new function → Via editor → name it `studium-drive` → replace the
  code with all of `supabase/functions/studium-drive/index.ts` → Deploy. Then open the function's **Details**
  and turn **Verify JWT** off (Google's redirect back to it has no Supabase login; the function checks logins itself).
- **Terminal** (from the repo): `npx supabase functions deploy studium-drive --project-ref ircgijvxzcxmcnyugdvm --no-verify-jwt`

## 5. Put the new build on studium.nz

Deploy the new `dist/web` build to Netlify as usual. Sign-in shows at **studium.nz/?full**. The plain demo at
studium.nz is unchanged (except playtesters' finish-card answers now save to `studium_feedback`).

## 6. Try it

1. **You, as the teacher**: studium.nz/?full → *I'm a teacher* → click the class name at the top → **Sign in
   with Google** → back in the teacher view, open the class name again → **Connect Google Drive** → pick
   samquinn2009@gmail.com → allow. You'll see "Google Drive connected". Note the class code.
2. **A student** (a private/incognito window, a different Google account): studium.nz/?full → **Continue with
   school Google** → type the class code once → make a workbook page → **sign out** (the name button on the hub).
3. In your Drive: **Studium Workbooks › <class name> › <student> · Workbook**, A3 pages, one per slide.
   *Update all now* in the class menu rebuilds every student's deck from what they last saved.

## How it behaves

- **Everything follows the student.** Signed in, a student's photos, edits, presets, folio, light table, workbook and
  quests save to their Google account (the private `studium-saves` bucket) about 20 seconds after each change, and again
  on sign-out. Signing in on another computer brings it all back; the newer copy wins. Another student's work left on a
  shared computer is never uploaded as yours. Needs the SQL from step 1 run again (it adds the bucket).

- A student's deck updates when they sign out. While they work, the workbook pages also save in the background
  every 10 minutes (only if something changed), so *Update all now* catches people who just closed the tab.
- Only pages that changed are uploaded. Decks only rebuild when a page changed.
- Students never get access to the decks. Studium can only see files it made in your Drive (`drive.file`).
- If you or a student edit a deck in Slides, the next rebuild replaces it. Make a copy first if you want to mark on it.
- Changing the Drive account (*Change account*) starts fresh folders and decks in the new Drive.

## For schools (Burnside IT and anyone else)

Google Workspace for Education blocks students under 18 from signing in to apps the school hasn't approved.
IT needs to mark Studium as trusted once: Admin console → Security → Access and data control → API controls →
App access control → Manage third-party app access → Configure new app → search the **Client ID** → Trusted.
Your Drive connection uses your own Gmail, so it isn't affected.

## Still on one computer only

Photos and the workbook itself still live on the computer the student used. The cloud copy is the page images
for the deck, so a student who moves to another PC starts with an empty workbook there. Saving the whole session
to the cloud is the next step after this.
