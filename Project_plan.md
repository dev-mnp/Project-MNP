# Project Modules

---


* Landing Page - Add content about Makkal Nala Pani, Countdown for Event 

1. Master Data Entry 
   - **District** Beneficiaries:
        - Select District name, list of articles and its quantity, comments. 
        - Prices are autofilled from a Articles list. Articles with 
            0(unknown or Fluctuating) prices are manually entered.
        - Multiples entries are allowed in case of Aid or Project and advised to add comments to uniquely identify.
   - **Public** Beneficiaries
     - Beneficiaries have only one Article or Aid
     - Each Beneficiary is verified with their past records and present based on Aadhar Number. But can be considered in some cases.
     - No budget alloted. but we check the total 
   - **Institution & Other** Beneficiaries
     - Institutions handle multiple articles and aids. No verification needed
     - No Budget alloted, but we calculate only the total accrued.
2. Article Management
   - Manage list of articles , its high level and Medium level category, price, etc
3. Order Management - (Requirement overview)
    - Sum of its Requirement based on Beneficiaries and ordered status
4. Ordering and Fundraising
   - We need two tightly linked features built on a single item master so there is no duplication or mismatch: first, 
   an Order Overview menu that acts as a live dashboard showing every required item with total needed, ordered, pending 
   and funded quantities, where clicking an item reveals beneficiary types and counts, and where status indicators are 
   colour coded green if fully ordered and funded, red if not ordered or not funded, and amber if partial or excess; 
   second, an Order and Fundraising management menu where orders are created via a vendor-facing form capturing vendor 
   details, quoted article names, quantities, prices and tax, with each vendor article mandatorily mapped to an internal 
   item to generate and store a purchase order PDF, and where fundraising reuses the same order data without re-entry,
   adds Aid and Project Type which must be linked exactly to specific records and Article Type which can be linked generally, 
   and generates a separate fundraising PDF, with both order and fundraising outputs automatically updating the Order 
   Overview status based on computed required, ordered and funded values from Supabase-backed relational tables.
5. Waiting Hall Quantity vs Stage Quantity
      - After communicating with the Beneficiaries these values are decided
      - How many do they collect at Waiting Hall in Bulk vs How many they collect at the Stage
      - Tokens are alloted only for Stage Quantity and Acknowledgment Receipt is provided for Hall quantity
      - Chairs are alloted based on this Stage Quantity
6. Sequence List
    - Sequence order for Stage distribution. Major and Lite article are first moved and the heavy are kept in place for last.
    - numbers range from 1 to N.
    - Article list and sequence number colums are merged with the finalised Master data
    - display a  table that is editable with filters to add seq number
7. Token generation
    - based on the Finalised master data and the Sequence and within sequence in the order of  District, Public, instn.
    - Add a upload csv option , that will provide options to downlaod tokens by District level(beneficiary token) and article level(stick on article)
    - Chair Label, VIP label, 2L labels, etc 
    - Generate Declaration form for Public beneficiaries
8. Reports
    - From the Master record , we use it as final to create reports. 
      - Article wise District
      - District wise articles
      - Consolidated report for diaz and VIPs
      - other reports
9. Dashboards 
    - Summary of modules ( Inventory, Master data, Data collection completed or not status, etc)
10. User Management 
11. Audit Logs
12. Detailed documentation of the Project Workings, Credentials, for KT
13. A event wrapup strategy - Backup Codes, files from supabase for reuse


# Data Available/Required

---
1. Master Record - From Data Entry
2. Article List
3. District Beneficiary info
4. Sequence list
5. Past Public beneficiary
6. Waiting Hall QTY vs Stage Quantity list
7. Order Requirements


# Issues:

---
1. District data entry - collapse others when one district is open
2. Public Validation - Consider present added record saying duplicate entry
3. Price need to update in master once fund rising are made to actual price
4. clubbed articles need to be seperately listed in order management
5. in data entry - district - when multiple same entries are added, the price stays the same
6. article search bar inside data entry should not reset after searched and added.
7. Keep Save and cancel in the bottom
8. Save button take few seconds to take effect, so when save button doesnt show change. multiple click leads to multiple 
   request adding more data. Hence, show a laoding sign once clicked and show Save button only when change is made, else only cancel button.
9. while selecting same item in data entry, keep a + sign so it can be added right there, instead of drop down
10. public app number be editable but automatic and the order be in ascending while listed 
11. in master data add columns for beneficiary type, article category
12. Status not needed in Article management
13. Need to add Blind Laptop as a new article
14. if i rename  laptop to blind laptop at last moment, although its been orderd and fund raised, how does it reflect?
15. in public validation - add a column comments to check why they are rejected as well.
16. Add a timestamp at footer for last app modification time and last data enty time in portal.

# Module to Work Next:

---

## 1. Clarity you can articulate to your developer

At a high level, you want to separate **planning, ordering, and funding**, but keep them **tightly linked through a single item master** so reporting stays accurate.

### Core idea in simple words

* You already have an **item list** that represents what the event needs.
* Different beneficiary types request these items.
* Vendors supply these items through formal purchase orders.
* Donors fund these items through fundraising documents.
* The system must always know, for each item:

  * how many are required
  * how many are ordered
  * how many are funded
  * who requested them and why

### What the new feature really is

You want **two new menus** that work together.

#### 1. Order Overview 

This is a **read-only control panel** that answers:

* What items are needed?
* What is already ordered?
* What is still pending?
* What is funded?

Clicking an item should reveal:

* beneficiary types that requested it
* count requested per beneficiary type

The status must be visually obvious:

* green if fully ordered and fully funded
* red if not ordered and not funded
* amber if partially ordered, partially funded, or excess

#### 2. Order and Fundraising Management (action menu)

This menu is where work happens.

It has two sub flows:

* Order creation
* Fundraising creation

Both flows must reuse the same underlying order data to avoid duplication or mismatch.



### Feature: Order Overview and Order and Fundraising Management

#### Objective

Add a structured system to manage event items from requirement to ordering and fundraising, with real-time visibility of status and clear linkage between beneficiaries, vendors, and donors.

---

## A. New Menu 1: Order Overview

### Purpose

A consolidated view of all required items and their current status.

### Page behaviour

* Display a table or list of all items from the master item list.
* For each item show:

  * Total quantity required
  * Quantity ordered
  * Quantity pending
  * Quantity funded

### Item drill-down

* Clicking an item opens a detailed view showing:

  * Beneficiary type
  * Quantity requested by each beneficiary type

### Status indicators

* Green icon

  * Item fully ordered AND fully funded
* Red icon

  * Item not ordered OR not funded
* Amber icon

  * Partial order
  * Partial funding
  * Over-ordered or over-funded compared to requirement

Status should auto-update based on order and fundraising records.

---

## B. New Menu 2: Order and Fundraising Management

This menu contains two functional sections.

---

### B1. Order Management

#### Order creation form

Fields required:

* Vendor details

  * Vendor name
  * Address
  * Contact details
* Order details

  * Article name as per vendor quotation
  * Quantity
  * Unit price
  * Tax
  * Total price

#### Item mapping

* Each vendor article must be mapped to:

  * One corresponding item from the internal item list
* Mapping is mandatory to ensure reporting consistency.

#### Output

* Generate a purchase order PDF
* PDF format based on the quotation template
* PDF stored and linked to the order record (Feasible?)
* Order status updated in Order Overview

---

### B2. Fundraising Management

#### Data source

* Fundraising must reuse the same order data used for purchase order generation.
* No manual re-entry of order amounts.

#### Additional fundraising fields

* Aid and Project Type

  * Must be linked exactly to a specific fundraising record
  * No loose or generic mapping allowed
* Article Type

  * Can be mapped generally to items

#### Mapping rules

* Article Type can be reused across items
* Aid and Project Type must be one-to-one with a specific record

#### Output

* Generate a fundraising PDF in the required fundraising format
* PDF stored and linked to fundraising record
* Funding status updated in Order Overview

---

## C. Status Logic (Critical)

For each item in the item master:

* Required quantity comes from beneficiary requests
* Ordered quantity comes from purchase orders
* Funded amount comes from fundraising records

Colour logic:

* Green

  * Ordered quantity equals required quantity
  * Funded amount equals total order value
* Amber

  * Partial order or partial funding
  * Excess order or excess funding
* Red

  * No order or no funding
