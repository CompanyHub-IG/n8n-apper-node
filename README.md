# n8n-nodes-apper

This is an n8n community node. It lets you use [Apper](https://apper.io) in your n8n workflows.

Apper is a no-code database/app platform for building custom business apps with tables, records, and automations. This package provides two nodes: an **Apper Trigger** node that starts workflows on [triggering event — e.g. new/updated records], and an **Apper** node that lets you create, read, update, delete, and search records in your Apper tables.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Apper Trigger

The **Apper Trigger** node starts a workflow when [describe the triggering event — e.g. "a new record is created in a table" / "a record is updated" / runs on a schedule via polling]. Configure it by selecting the **App** and **Table** to watch[, and the event type, if applicable].

### Record actions (Apper node)

The node supports the **Record** resource with the following operations:

- **Create** – Create a single record in a table
- **Create Multiple Records** – Create multiple records in a table in one call, with a repeatable "Add Record" line-item UI
- **Get** – Retrieve a single record by ID
- **Search** – Search a table for records matching a field value (exact match)
- **Update** – Update a single record by ID
- **Update Multiple Records** – Update multiple records in a table in one call, with a repeatable "Add Record" line-item UI
- **Delete** – Delete a single record by ID
- **Delete Multiple Records** – Delete multiple records by a comma-separated list of IDs

For every operation, you pick the **App** and **Table** from searchable dropdowns (or enter their IDs directly). Field columns are loaded dynamically from your table's schema, so the input form always matches your table's actual fields and types (text, number, boolean, date, dropdown/select).

**Note on People-type fields:** if your table has a "People" (user assignment) field, enter the user's ID as a plain string — the node automatically converts it to the format Apper's API expects.

**Note on partial updates:** the Update and Update multiple records operations only send the fields you explicitly add via "Add field to send" — untouched fields are never included in the request, so existing data on the record is never accidentally overwritten with blanks.

## Credentials

You'll need an Apper API key to use this node.

1. Log in to your [Apper account](https://apper.integrately.com/login).
2. Click your profile icon, then select **API Keys**.
3. Click **+ Create API Key**.
4. Enter a description for the key, then click **Create API Key**.
5. Copy the generated API key.
6. In n8n, create new credentials of type **Apper API** and paste in your API key.


## Compatibility

- Minimum n8n version: 1.0.0 (tested against the latest stable n8n release (version 2.1.4))
- No known version incompatibilities at this time.

## Usage

- Use the **Apper Trigger** node to start a workflow automatically when [triggering event]. Select the App and Table you want to watch[, and configure polling interval/event type as needed].
- Use the **Apper** node's **Record** resource to create, read, update, delete, or search records as a step within a workflow — whether triggered by Apper Trigger or anything else (schedule, webhook, another app).
- Start by selecting **Record** as the resource, then choose an operation.
- Use the **App** and **Table** fields' "From List" mode to search and select by name, or switch to "ID" mode to enter a raw App/Table ID directly (useful in expressions or when chaining from a previous node).
- For **Create**/**Update**, click "Add field to send" under Columns to pick which table columns to set.
- For **Create multiple records**/**Update multiple records**, click "Add Record" to add each row; each row has its own set of column inputs.
- For **Search**, pick a field from the "Search Field" dropdown and enter the value to match — this performs an exact match, not a partial/contains search.
- If you're new to n8n, see the [Try it out](https://docs.n8n.io/try-it-out/) documentation to get started with the basics.


## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Apper API documentation](https://apper.io/learn/docs/getting-started/)

## Version history

- **0.1.1** – Initial release. Supports Create, Get, Search, Update, Delete, Create multiple records, Update multiple records, and Delete multiple records operations for Apper table records.