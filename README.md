<img src="https://cdn.statically.io/gh/craigary/nobelium/main/Nobelium-Logo.svg" width="50" height="50">

# Nobelium

A static blog build on top of Notion and Nextjs, deployed on [Vercel](https://vercel.com?utm_source=Craigary&utm_campaign=oss).

<p>
  <a aria-label="GitHub commit activity" href="https://github.com/craigary/nobelium/commits/main" title="GitHub commit activity">
    <img src="https://img.shields.io/github/commit-activity/m/craigary/nobelium?style=for-the-badge">
  </a>
  <a aria-label="GitHub contributors" href="https://github.com/craigary/nobelium/graphs/contributors" title="GitHub contributors">
    <img src="https://img.shields.io/github/contributors/craigary/nobelium?color=orange&style=for-the-badge">
  </a>
  <a aria-label="Build status" href="#" title="Build status">
    <img src="https://img.shields.io/github/deployments/craigary/nobelium/Preview?logo=Vercel&style=for-the-badge">
  </a>
  <a aria-label="Powered by Vercel" href="https://vercel.com?utm_source=Craigary&utm_campaign=oss" title="Powered by Vercel">
    <img src="https://www.datocms-assets.com/31049/1618983297-powered-by-vercel.svg" height="28">
  </a>
</p>

Demo: [https://nobelium.vercel.app/](https://nobelium.vercel.app/)

<details><summary>Screenshot</summary>
<img src="https://github.com/craigary/nobelium/blob/main/desktop.png?raw=true">
</details>

## Highlights ✨

**🚀 &nbsp;Fast and responsive**

- Fast page render and responsive design
- Fast static generation with efficient compiler

**🤖 &nbsp;Deploy instantly**

- Deploy on Vercel in minutes
- Incremental regeneration and no need to redeploy after update the content in notion

**🚙 &nbsp;Fully functional**

- Comments, full width page, quick search and tag filter
- RSS, analytics, web vital... and much more

**🎨 &nbsp;Easy for customization**

- Rich config options, support English & Chinese interface
- Built with Tailwind CSS, easy for customization

**🕸 &nbsp;Pretty URLs and SEO friendly**

## Quick Start

- Star this repo 😉
- Duplicate [this Notion template](https://craigary.notion.site/ee99f65a23ab44f8ac80270122ee8138)
- [Fork](https://github.com/craigary/nobelium/fork) this project
- Customize `blog.config.js`
- _(Optional)_ Replace `favicon.svg`, and `favicon.ico` in `/public` folder with your own
- Create a [Notion integration](https://www.notion.so/my-integrations) and **share your database with it** (the `•••` menu on the database → Connections → your integration). Your pages can stay **private** — they do not need to be shared to the web.
- Deploy on [Vercel](https://vercel.com), set following environment variables：
  - `NOTION_PAGE_ID` (Required): Your Notion **database ID** (the database that stores posts/pages)
  - `NOTION_API_KEY` (Required): Official Notion integration key (`secret_...` / `ntn_...`)
- **That's it!** Easy-peasy?

> Nobelium reads everything through the official Notion API (both the post list and the page content), so you only need the integration key plus the database ID — no public sharing and no `token_v2`.

### Multi-author posts (optional)

Add a **`authors`** property of type **Person** to your Notion database. Each post will
then display the people listed there (name + avatar) instead of the single author from
`blog.config.js`. Avatars are fetched from [Gravatar](https://gravatar.com) using each
author's email, so authors get a picture by registering that email on Gravatar (otherwise
an auto-generated identicon is shown).

> For emails to be available, your Notion integration needs the **"Read user information,
> including email addresses"** capability (Integration settings → Capabilities). Posts with
> no `authors` set fall back to the author defined in `blog.config.js`.

<details><summary>Wait for a sec, what is Page ID？</summary>
  <img src="https://github.com/craigary/nobelium/blob/main/pageid.png?raw=true">
</details>

## Play With Docker

Unofficial, thanks to [@Vaayne](https://github.com/craigary/nobelium/pull/157)'s work!

### Build Docker image yourself
```
# set env
export NOTION_PAGE_ID=xxx # your NOTION_PAGE_ID
export IMAGE=nobelium:latest

# build with docker
docker build -t ${IMAGE} --build-arg NOTION_PAGE_ID .

# run with docker
docker run -d --name nobelium -p 3000:3000 -e NOTION_PAGE_ID=${NOTION_PAGE_ID} nobelium:latest
```

### Use default docker image
```
# pull image
docker pull ghcr.io/craigary/nobelium:main

# run with docker
docker run -d --name nobelium -p 3000:3000 -e NOTION_PAGE_ID=${NOTION_PAGE_ID} ghcr.io/craigary/nobelium:main
```

## Roadmap

Check out our roadmap [here](https://craigary.notion.site/Public-Roadmap-89d184e51653445ab5b347e4efac079e)

- [x] Better SEO
- [x] Dark mode
- [x] Open Graph support
- [x] Switch to react-notion-x
- [x] Sitemap
- [ ] ...

## Technical details

- **Generation**: Next.js and Incremental Static Regeneration
- **Page render**: [react-notion-x](https://github.com/NotionX/react-notion-x)
- **Style**: Tailwind CSS and `@tailwindcss/jit` compiler
- **Comments**: Gitalk, Cusdis and more

## FAQ

<details>
  <summary>How can I change my avatar?</summary>
  Nobelium fetches avatars from <a href="https://gravatar.com">Gravatar</a>. You need to set your avatar there with <strong>the same email address</strong> that you defined in <code>blog.config.js</code>.
</details>
<details>
  <summary>My posts disappear after I set up grouping in Notion database!</summary>
  Nobelium currently doesn’t support Notion database grouping. If you really want to manage your posts by groups, you can create views with filters instead.
</details>

## Special Thanks

<table><tr align="left">
  <td align="center"><a href="https://notion.so/cnotion" title="Notion CN Community"><img src="https://avatars.githubusercontent.com/u/4792552" width="64px;"alt="Notion CN Community"/></a><br/><a href="https://notion.so/cnotion" title="Notion CN Community">Notion CN Community</a></td>
  <td align="center"><a href="https://twitter.com/SilentDepthCN" title="SilentDepth"><img src="https://avatars.githubusercontent.com/u/7194254" width="64px;" alt="yokinist"/></a><br/><a href="https://twitter.com/SilentDepthCN" title="SilentDepth">SilentDepth</a></td>
  <td align="center"><a href="https://leerob.io/" title="Lee Robinson"><img src="https://avatars.githubusercontent.com/u/9113740" width="64px;" alt="Reynard"/></a><br/><a href="https://leerob.io" title="Lee Robinson">Lee Robinson</a></td>
  <td align="center"><a href="https://spencerwoo.com/" title="Spencer Woo"><img src="https://avatars.githubusercontent.com/u/32114380" width="64px;" alt="Niin"/></a><br/><a href="https://spencerwoo.com" title="Spencer Woo">Spencer Woo</a></td>
</tr></table>

## Contributors

<table><tr align="left">
  <td align="center"><a href="https://github.com/craigary"><img src="https://avatars.githubusercontent.com/u/10571717" width="64px;"alt="Craig Hart"/><br/><sub><b>Craig Hart</b></sub></a><br/><a href="https://github.com/craigary/nobelium/commits?author=craigary" title="Owner" >🎫 🔧 🎨 🐛</a></td>
  <td align="center"><a href="https://github.com/yokinist"><img src="https://avatars.githubusercontent.com/u/19779874" width="64px;" alt="yokinist"/><br/><sub><b>yokinist</b></sub></a><br/><a href="https://github.com/craigary/nobelium/commits?author=yokinist" title="yokinist" >🔧 🐛</a></td>
  <td align="center"><a href="https://github.com/reycn"><img src="https://avatars.githubusercontent.com/u/11225092" width="64px;" alt="Reynard"/><br/><sub><b>Reynard</b></sub></a><br/><a href="https://github.com/craigary/nobelium/commits?author=reycn" title="Reynard" > 🎨 🐛</a></td>
  <td align="center"><a href="https://github.com/Niinjoy"><img src="https://avatars.githubusercontent.com/u/39721307" width="64px;" alt="Niin"/><br/><sub><b>Niin</b></sub></a><br/><a href="https://github.com/craigary/nobelium/commits?author=Niinjoy" title="Niin" >🔧 🐛</a></td>
  <td align="center"><a href="https://github.com/ruter"><img src="https://avatars.githubusercontent.com/u/8568876" width="64px;" alt="Ruter"/><br/><sub><b>Ruter</b></sub></a><br/><a href="https://github.com/craigary/nobelium/commits?author=ruter" title="Ruter" >🔧 🐛</a></td>
</tr></table>

## Sponsor

[![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")

## License

The MIT License.
