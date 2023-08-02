import "./app.ts";
import { importCsv, modify, saveDb } from "@yolm/boost/procHelpers";
import { addScript } from "@yolm/boost/modelHelpers";
import "./csvScriptDb.ts";

addScript({
  name: "init-dev-db",
  procedure: [
    importCsv(`csv`, `data/csv`),
    modify(
      `insert into db.user (global_id, is_sys_admin, is_admin, disabled, email) values (random.uuid(), true, true, false, 'coolguy@coolemail.com')`
    ),
    modify(`insert into db.employee 
    select
      FirstName as first_name,
      LastName as last_name,
      Title as title,
      ReportsTo - 1 as reports_to,
      cast(substring(BirthDate from 1 for 10) as date) as birth_date,
      cast(substring(HireDate from 1 for 10) as date) as hire_date,
      Address as street,
      City as city,
      State as state,
      Country as country,
      PostalCode as zip,
      Phone as phone,
      Fax as fax,
      Email as email
    from csv.employee`),
    modify(`insert into db.artist select Name as name from csv.artist`),
    modify(
      `insert into db.album select Title as title, ArtistId - 1 as artist from csv.album`
    ),
    modify(`insert into db.customer
    select
      FirstName as first_name,
      LastName as last_name,
      Company as company,
      Address as street,
      City as city,
      State as state,
      Country as country,
      PostalCode as zip,
      Phone as phone,
      Fax as fax,
      Email as email,
      SupportRepId - 1 as support_rep
    from csv.customer`),
    modify(`insert into db.genre (name) select Name as name from csv.genre`),
    modify(`insert into db.invoice 
    select
      CustomerId - 1 as customer,
      cast(substring(InvoiceDate from 1 for 10) as date) as invoice_date,
      BillingAddress as billing_street,
      BillingCity as billing_city,
      BillingState as billing_state,
      BillingCountry as billing_country,
      BillingPostalCode as billing_postal_code,
      Total as total
    from csv.invoice`),
    modify(`insert into db.playlist select Name as name from csv.playlist`),
    modify(`insert into db.track 
    select
      Name as name,
      AlbumId - 1 as album,
      cast(
        case
          when MediaTypeId = 1 then 'mpeg'
          when MediaTypeId = 2 then 'protected_aac'
          when MediaTypeId = 3 then 'protected_mpeg4'
          when MediaTypeId = 4 then 'purchased_aac'
          when MediaTypeId = 5 then 'aac'
        end
        as enums.media_type
      ) as media_type,
      GenreId - 1 as genre,
      Composer as composer,
      Milliseconds as milliseconds,
      Bytes as bytes,
      UnitPrice as unit_price
    from csv.track`),
    modify(`insert into db.invoice_line
    select
      InvoiceId - 1 as invoice,
      TrackId - 1 as track,
      UnitPrice as unit_price,
      Quantity as quantity
    from csv.invoice_item`),
    modify(
      `insert into db.playlist_track select PlaylistId - 1 as playlist, TrackId - 1 as track from csv.playlist_track`
    ),
    saveDb(`data/dev`),
  ],
});
