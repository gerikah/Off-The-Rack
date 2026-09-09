# OFF THE RACK

**Wearable art. Hand-painted denim. One piece at a time.**

Off The Rack is a streetwear and upcycled fashion brand focused on transforming denim into unique, hand-painted pieces. This project is the official website concept for the brand, designed to showcase available pieces, past creations, custom work, and the story behind each design.

## About the Project

The Off The Rack website is designed to move the brand beyond social-media-only selling and create a dedicated digital space for its products and identity.

Rather than looking like a traditional e-commerce store, the website focuses on the handcrafted nature of the pieces through bold visuals, editorial layouts, product photography, and storytelling.

The experience aims to make each item feel less like a mass-produced product and more like a piece of wearable art.

## Goals

* Establish a stronger digital identity for Off The Rack
* Showcase hand-painted denim and other upcycled pieces
* Make available products easier to discover
* Highlight the handmade process behind each piece
* Provide information about custom orders
* Showcase previously sold and completed designs
* Create a responsive experience across desktop, tablet, and mobile
* Build a foundation that can eventually support full e-commerce functionality

## Website Structure

### Home

Introduces Off The Rack through a strong visual hero, featured pieces, brand story, craftsmanship, and selected collections.

### Shop

Displays available pieces with product images, pricing, sizing, availability, and filtering options.

### Product Details

Provides detailed photographs, product information, sizing, materials, availability, and purchasing options for an individual piece.

### Custom Denim

Explains the custom-order process and allows customers to inquire about personalized designs.

### Gallery

An archive of previous Off The Rack creations, including sold pieces and experimental designs.

### About

Tells the story behind Off The Rack, its creative direction, and the process of turning existing denim into wearable artwork.

### Contact

Provides customer inquiry options and links to the brand's social platforms.

## Design Direction

The visual direction combines **streetwear, grunge, rock, industrial design, and cybersigilism** with a more refined editorial fashion aesthetic.

The interface uses:

* Dark and neutral color palettes
* Large editorial typography
* Oversized product photography
* Denim and distressed textures
* Minimal UI elements
* Strong visual hierarchy
* Subtle motion and hover interactions
* Responsive layouts
* Product-focused storytelling

The products remain the main source of color so that individual artwork stands out against the interface.

## Core Features

* Responsive navigation
* Featured product collections
* Product catalog
* Product detail pages
* Product availability/status
* Custom-order information
* Previous work gallery
* Brand and process storytelling
* Social media integration
* Contact and inquiry options
* Responsive desktop, tablet, and mobile layouts

## Design & Development

**Design**

* Figma
* Figma AI

**Development**

* Next.js + React + TypeScript
* Supabase data layer (ready to connect)
* CSS design tokens and responsive editorial layouts

**Version Control**

* Git
* GitHub

## Project Status

🚧 **Currently in development**

The project is being developed iteratively, beginning with the brand experience, information architecture, wireframes, and UI design before moving into the final implementation.

## Future Improvements

Potential future additions include:

* Full e-commerce checkout
* Shopping bag and wishlist
* Customer accounts
* Order tracking
* Online payments
* Custom-design request forms
* Product drop notifications
* Inventory management
* Size guides
* Customer reviews
* Lookbook/editorial collections

## About Off The Rack

Off The Rack gives existing denim a new identity through hand-painted artwork and creative customization.

Each piece is individually worked on rather than mass-produced, making variations and imperfections part of the final design.

**Off The Rack — made by hand, made to be different.**


## Run the storefront

The responsive storefront is implemented. Run `npm ci` and `npm run dev`, then open http://localhost:3000. On restricted PowerShell setups, use `npm.cmd`.

Catalog details are placeholders until the database is connected. Forms show an honest preview state without Supabase credentials.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup, checks, architecture, Supabase migration, content handoff and Vercel deployment.
