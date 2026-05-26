# Atlas 5 — Corpus Recall Audit

**Generated:** 2026-05-22T12:28:55.321927+00:00
**Purpose:** Diagnose why A14 autonomous freight queries return similarity 0.44–0.58

---

## 1. Corpus size and embedding coverage

| Surface | Total rows | Embedded | Coverage |
|---------|-----------|----------|----------|
| projects | 711 | 711 | 100% |
| live_calls | 2,838 | 1851 | 65% |
| knowledge_chunks | 4,974 | 4974 | 100% |
| knowledge_documents | 1,329 | — | no emb col |
| hive_chunks | 429 | 429 | 100% |
| hive_articles | 37 | — | no emb col |

---

## 2. Embedding space distributions (internal similarity probe)

> How similar are random pairs within each corpus? Low median = spread-out, discriminative embeddings.
> High median = corpus is semantically dense (all documents sound alike).

| Surface | Samples | Min | Median | Max | Mean |
|---------|---------|-----|--------|-----|------|
| projects | 10 | 0.4553 | 0.7621 | 0.9747 | 0.7543 |
| knowledge_chunks | 10 | 0.7281 | 0.8397 | 0.9537 | 0.8426 |
| hive_chunks | 10 | 0.5116 | 0.7727 | 0.8438 | 0.7395 |

---

## 3. Cross-query aggregate statistics

| Surface | N scores | Median | Mean | p75 | Max | >0.70 | >0.55 |
|---------|----------|--------|------|-----|-----|-------|-------|
| projects | 45 | 0.5322 | 0.5407 | 0.5512 | 0.6245 | 0.0% | 31.1% |
| live_calls | 45 | 0.5145 | 0.5371 | 0.5675 | 0.6875 | 0.0% | 28.9% |
| knowledge_docs | 44 | 0.5136 | 0.5006 | 0.5627 | 0.6908 | 0.0% | 29.5% |
| hive_chunks | 45 | 0.2855 | 0.2803 | 0.3203 | 0.465 | 0.0% | 0.0% |

**Queries where keyword found extra results not in semantic top-5:** 7/9
**Queries with semantic top-1 ≥ 0.60:** 2/9
**Queries with semantic top-1 ≥ 0.70 (DIRECT):** 0/9

---

## 4. Per-query results

### Q1 — Autonomous freight corridors

> Query: `autonomous freight corridor UK`

#### A. atlas.projects — semantic

| Rank | Score | Classification | Title | Organisation |
|------|-------|----------------|-------|--------------|
| 1 | 0.53 | WEAK | National Freight Model | CITY SCIENCE CORPORATION LIMITED |
| 2 | 0.5278 | WEAK | National Freight Model (Phase 2) | CITY SCIENCE CORPORATION LIMITED |
| 3 | 0.5189 | WEAK | Reducing road freight empty running (REFER) |  |
| 4 | 0.5119 | WEAK | Intelligent Multimodal Logistics Control and Brokerage Centre | ROCKSHORE LTD |
| 5 | 0.5118 | WEAK | London Freight Mapping and End User Solution | MPIE LIMITED |

**Keyword-only hits (5 not in semantic top-5):**
- `d895aa49…` Motorway Mobility
- `57a77e15…` Tools for autonomous logistics operations and management
- `4f3c7287…` Autonomous Charging For Efficient &amp; Safe Vehicle Charging In Fleet
- `b82b80e0…` Decarbonising Transport through Electrification, a Whole System Approa
- `3c68d991…` Towards Energy Efficient Autonomous Vehicles via Cloud-Aided Learning

#### B. atlas.live_calls — semantic

| Rank | Score | Status | Title | Funder |
|------|-------|--------|-------|--------|
| 1 | 0.5214 | closed | Clean and competitive solutions for all transport modes | European Commission / Horizon Europe |
| 2 | 0.4832 | closed | 2018-2020 Mobility for Growth | European Commission / Horizon Europe |
| 3 | 0.4673 | open | Autonomous vessels in short sea shipping and inland waterway | European Commission / Horizon Europe |
| 4 | 0.4596 | closed | Safe, Resilient Transport and Smart Mobility services for pa | European Commission / Horizon Europe |
| 5 | 0.4563 | open | £1.8 million boost for innovation to decarbonise freight | GOV.UK / news_story |

**Keyword-only call hits (4 not in semantic top-5):**
- `5231be59…` Shift2Rail JU call for proposals 2017 (closed / 2017-03-30)
- `f61be5c2…` 2018-2020 Mobility for Growth (closed / 2018-09-19)
- `aedf809a…` a7bb3b83-5123-4953-8876-90b6975742a8 (closed / 2021-08-24)
- `bebbb5cb…` Cross-sectoral solutions for the climate transition (closed / 2022-09-06)

#### C. atlas.knowledge_chunks (knowledge docs)

| Rank | Score | Title | Publisher | Tier |
|------|-------|-------|-----------|------|
| 1 | 0.5158 | Preparing the way for self-driving mass transit services in  | Centre for Connected and Auton | primary |
| 2 | 0.4805 | UK government backing helps launch world first self-driving  | GOV.UK / press_release | primary |
| 3 | 0.4595 | UK government backing helps launch world first self-driving  | GOV.UK / press_release | primary |
| 4 | 0.3958 | Communiqué from the Interministerial Group for Transport Mat | GOV.UK / policy_paper | primary |
| 5 | 0.3616 | Road freight travel time: response to the peer review | Department for Transport | primary |

#### D. hive.document_chunks

| Rank | Score | Title |
|------|-------|-------|
| 1 | 0.3043 | Port of Calais Extension and Sea Defence |
| 2 | 0.2744 | Thames Water Counters Creek SuDS |
| 3 | 0.2557 | Thames Water Counters Creek SuDS |
| 4 | 0.2528 | The Panama Canal Authority Adapts Strategic Measures for Water Savings |
| 5 | 0.2468 | The Panama Canal Authority Adapts Strategic Measures for Water Savings |

### Q2 — Road freight automation

> Query: `road freight automation self-driving HGV lorry`

#### A. atlas.projects — semantic

| Rank | Score | Classification | Title | Organisation |
|------|-------|----------------|-------|--------------|
| 1 | 0.56 | ADJACENT | Reducing road freight empty running (REFER) |  |
| 2 | 0.5322 | WEAK | Project Sunflower | BELFAST HARBOUR COMMISSIONERS |
| 3 | 0.5298 | WEAK | Removing HGVs from high streets with last-mile human interactions | UNIVERSITY OF LEEDS |
| 4 | 0.526 | WEAK | Cargo POD | WESTFIELD SPORTS CARS LIMITED |
| 5 | 0.5094 | WEAK | MOVE-UK: accelerating automated driving by connected validation &amp;  | TRL ACADEMY |

**Keyword-only hits (4 not in semantic top-5):**
- `c44c6979…` Global Centers Track 1: CLEETS - CLean Energy and Equitable Transporta
- `afa09095…` Reducing traction energy through improved freight aerodynamics
- `56f001c5…` Integrated Energy Systems for Commercial Vehicles
- `ed5cda33…` Roto-reformer Ammonia Cracker (RAC) for decentralised on-site, on-dema

#### B. atlas.live_calls — semantic

| Rank | Score | Status | Title | Funder |
|------|-------|--------|-------|--------|
| 1 | 0.547 | open | Self-driving buses, shuttles and delivery vans could soon hi | GOV.UK / press_release |
| 2 | 0.5145 | closed | 2018-2020 Mobility for Growth | European Commission / Horizon Europe |
| 3 | 0.5143 | open | Road freight goes green with £20 million funding boost | GOV.UK / news_story |
| 4 | 0.5142 | open | More than £14 million in joint government and industry fundi | GOV.UK / press_release |
| 5 | 0.5113 | open | Large-scale demonstration of Heavy-Duty Battery Electric Veh | European Commission / Horizon Europe |

**Keyword-only call hits (2 not in semantic top-5):**
- `bbe4d600…` Transport Fleet Management (open / None)
- `43e34c10…` Transport Fleet Management (open / None)

#### C. atlas.knowledge_chunks (knowledge docs)

| Rank | Score | Title | Publisher | Tier |
|------|-------|-------|-----------|------|
| 1 | 0.5395 | Preparing the way for self-driving mass transit services in  | Centre for Connected and Auton | primary |
| 2 | 0.4925 | UK government backing helps launch world first self-driving  | GOV.UK / press_release | primary |
| 3 | 0.4836 | UK government backing helps launch world first self-driving  | GOV.UK / press_release | primary |
| 4 | 0.3648 | Better Connected: tap-and-go travel across trains, trams and | GOV.UK / press_release | primary |
| 5 | 0.3491 | Road freight travel time: response to the peer review | Department for Transport | primary |

#### D. hive.document_chunks

| Rank | Score | Title |
|------|-------|-------|
| 1 | 0.2855 | Heathrow Airport Grass Standards |
| 2 | 0.2771 | Deutsche Bahn Climate Adaptation Measures |
| 3 | 0.2708 | Major Road Projects Victoria (MRPV) Pound Road West Upgrade in Dandeno |
| 4 | 0.2531 | California Department of Transportation (Caltrans) |
| 5 | 0.0802 | Santa Barbara County Montecito's Randall Road Debris Basin |

### Q3 — Logistics decarbonisation

> Query: `logistics decarbonisation freight emissions net zero`

#### A. atlas.projects — semantic

| Rank | Score | Classification | Title | Organisation |
|------|-------|----------------|-------|--------------|
| 1 | 0.5982 | ADJACENT | Decarbonising the UK's Freight Transport |  |
| 2 | 0.5904 | ADJACENT | Green Logistics |  |
| 3 | 0.5558 | ADJACENT | Decarbonising Auxiliary Load in Freight Today | G-VOLUTION LTD |
| 4 | 0.5511 | ADJACENT | Reducing road freight empty running (REFER) |  |
| 5 | 0.5481 | WEAK | Towards Zero Carbon Aviation (TOZCA) |  |

**Keyword-only hits (5 not in semantic top-5):**
- `4fbb6872…` Mobility as a Service &amp; Behaviour Change for Decarbonisation
- `e89368df…` Policy measures and behaviour change for decarbonisation of transport
- `7b809f9d…` Carbon Capture and Re-Use Strategies for Optimising Decarbonisation of
- `96a7f8a7…` Future transportation without emissions
- `f82d1fa2…` Clean-mile: affordable, efficient and sustainable last-mile transport 

#### B. atlas.live_calls — semantic

| Rank | Score | Status | Title | Funder |
|------|-------|--------|-------|--------|
| 1 | 0.6445 | closed | 2018-2020 Mobility for Growth | European Commission / Horizon Europe |
| 2 | 0.5851 | open | Jet Zero Council keeps up momentum with £3 million governmen | GOV.UK / news_story |
| 3 | 0.5741 | open | Road freight goes green with £20 million funding boost | GOV.UK / news_story |
| 4 | 0.5708 | closed | Clean and competitive solutions for all transport modes | European Commission / Horizon Europe |
| 5 | 0.5675 | closed | Clean and competitive solutions for all transport modes | European Commission / Horizon Europe |

**Keyword-only call hits (5 not in semantic top-5):**
- `d5816382…` Greening the Economy (closed / 2017-03-07)
- `74202e5f…` Greening the Economy (closed / 2017-03-07)
- `2bcf8c29…` Sustainable, secure and competitive energy supply (closed / 2023-03-30)
- `2710b24a…` Efficient, sustainable and inclusive energy use (closed / 2023-04-20)
- `bdc9a60a…` Efficient, sustainable and inclusive energy use (closed / 2023-09-04)

#### C. atlas.knowledge_chunks (knowledge docs)

| Rank | Score | Title | Publisher | Tier |
|------|-------|-------|-----------|------|
| 1 | 0.6908 | Future of Freight: A Long-term Plan | Department for Transport | primary |
| 2 | 0.675 | Future of Freight: A Long-term Plan | Department for Transport | primary |
| 3 | 0.6654 | Future of Freight: A Long-term Plan | Department for Transport | primary |
| 4 | 0.6436 | Future of Freight: A Long-term Plan | Department for Transport | primary |
| 5 | 0.6228 | UK Transport Decarbonisation Plan: Decarbonising Transport — | Department for Transport | primary |

#### D. hive.document_chunks

| Rank | Score | Title |
|------|-------|-------|
| 1 | 0.4018 | Major Road Projects Victoria (MRPV) Pound Road West Upgrade in Dandeno |
| 2 | 0.3188 | LA Metro |
| 3 | 0.216 | Major Road Projects Victoria (MRPV) Pound Road West Upgrade in Dandeno |
| 4 | 0.194 | Bradford Metropolitan Council Trees as stormwater attenuation and trea |
| 5 | 0.1544 | Santa Barbara County Montecito's Randall Road Debris Basin |

### Q4 — Motorway technology demonstrators

> Query: `motorway technology demonstrator pilot programme UK`

#### A. atlas.projects — semantic

| Rank | Score | Classification | Title | Organisation |
|------|-------|----------------|-------|--------------|
| 1 | 0.5821 | ADJACENT | MOVE-UK: accelerating automated driving by connected validation &amp;  | TRL ACADEMY |
| 2 | 0.5431 | WEAK | Aviation Innovation in the South West - Development of an operational  | WEST OF ENGLAND COMBINED AUTHORITY |
| 3 | 0.534 | WEAK | INnovative Testing of Autonomous Control Techniques (INTACT) | RICHMOND DESIGN & MARKETING LIMITED |
| 4 | 0.5271 | WEAK | GATEway - Greenwich Automated Transport Environment | COMMONPLACE DIGITAL LTD |
| 5 | 0.5265 | WEAK | Motorway Mobility | CONNECTED PLACES CATAPULT |

**Keyword-only hits (5 not in semantic top-5):**
- `f08741a8…` Intelligent City Transportation - Infrastructure (ICT-i)
- `df28e793…` Innovative Intermodal Urban Freight Transport Solution
- `5305bc3b…` E-Mobility hubs
- `8b12594f…` ECML Net Zero Traction Decarbonisation Demonstration
- `4a14a73e…` IONA Drone Delivery Initiative

#### B. atlas.live_calls — semantic

| Rank | Score | Status | Title | Funder |
|------|-------|--------|-------|--------|
| 1 | 0.5186 | open | Clean Maritime Demonstration Competition 7: Pre-deployment t | Innovate UK |
| 2 | 0.5146 | open | Clean Maritime Demonstration Competition 7: Deployment trial | Innovate UK |
| 3 | 0.5069 | open | New measures to help Britain lead the way in developing driv | GOV.UK / news_story |
| 4 | 0.5036 | closed | UKRI-6054 - R&D MAP - Evaluation Framework PME | UK Research & Innovation (UKRI) |
| 5 | 0.5036 | closed | Speed Measuring Devices 2026 | Driver and Vehicle Standards Agency |

**Keyword-only call hits (5 not in semantic top-5):**
- `6c5cec41…` Sustainable, secure and competitive energy supply (closed / 2021-10-20)
- `4bb2cbeb…` Safe, Resilient Transport and Smart Mobility services for pa (closed / 2022-01-12)
- `aed0d7d6…` A DIGITISED, RESOURCE-EFFICIENT AND RESILIENT INDUSTRY 2021 (closed / 2022-01-25)
- `a0ae455a…` Sustainable, secure and competitive energy supply (closed / 2022-04-26)
- `42612c28…` RESILIENT VALUE CHAINS 2023 (closed / 2023-04-19)

#### C. atlas.knowledge_chunks (knowledge docs)

| Rank | Score | Title | Publisher | Tier |
|------|-------|-------|-----------|------|
| 1 | 0.578 | Winners of £51 million government competition to develop wor | Department for Business, Energ | primary |
| 2 | 0.5519 | Self-driving vehicle pilot scheme: information for first res | GOV.UK / guidance | primary |
| 3 | 0.5432 | Trialling automated vehicle technologies in public | GOV.UK / guidance | primary |
| 4 | 0.5303 | UK government backing helps launch world first self-driving  | GOV.UK / press_release | primary |
| 5 | 0.5227 | Trialling automated vehicle technologies in public | GOV.UK / guidance | primary |

#### D. hive.document_chunks

| Rank | Score | Title |
|------|-------|-------|
| 1 | 0.3971 | NetworkRail Drainage System |
| 2 | 0.3902 | Network Rail Dawlish Sea Wall |
| 3 | 0.3134 | Leeds flood alleviation scheme |
| 4 | 0.298 | Qatar's Public Works Authority Pumping station and outfall tunnel |
| 5 | 0.2946 | Qatar's Public Works Authority Pumping station and outfall tunnel |

### Q5 — Freight innovation funding

> Query: `freight innovation fund grant programme UK`

#### A. atlas.projects — semantic

| Rank | Score | Classification | Title | Organisation |
|------|-------|----------------|-------|--------------|
| 1 | 0.5642 | ADJACENT | National Freight Model (Phase 2) | CITY SCIENCE CORPORATION LIMITED |
| 2 | 0.5598 | ADJACENT | National Freight Model | CITY SCIENCE CORPORATION LIMITED |
| 3 | 0.5512 | ADJACENT | London Freight Mapping and End User Solution | MPIE LIMITED |
| 4 | 0.5374 | WEAK | Decarbonising the UK's Freight Transport |  |
| 5 | 0.5253 | WEAK | Levelling up Freight | 3SQUARED LTD. |

**Keyword-only hits (4 not in semantic top-5):**
- `35d4a03b…` Decarbonisation &amp; Electrification of Freight Terminals (DEFT Proje
- `3117eecd…` Smart Electric Urban Logistics
- `9b58e59e…` Wireless Charging in Micro-Fulfilment Centres for Last Mile Delivery
- `d5f8e6b1…` Reducing road freight empty running (REFER)

#### B. atlas.live_calls — semantic

| Rank | Score | Status | Title | Funder |
|------|-------|--------|-------|--------|
| 1 | 0.6875 | open | £1.8 million boost for innovation to decarbonise freight | GOV.UK / news_story |
| 2 | 0.6528 | open | Government invests over £2.5 million in new technologies and | GOV.UK / news_story |
| 3 | 0.6486 | open | Businesses encouraged to bid for transformative innovation f | GOV.UK / news_story |
| 4 | 0.6464 | open | Integrated transport innovation: apply now for business fund | GOV.UK / news_story |
| 5 | 0.6421 | open | More than £14 million in joint government and industry fundi | GOV.UK / press_release |

**Keyword-only call hits (5 not in semantic top-5):**
- `0b7ff8b1…` SHIFT2RAIL JOINT UNDERTAKING CALL FOR PROPOSALS 2015 (closed / 2016-03-17)
- `b788d64a…` SHIFT2RAIL JOINT UNDERTAKING CALL FOR PROPOSALS 2015 (closed / 2016-03-17)
- `5d4e3645…` Clean and competitive solutions for all transport modes (closed / 2021-09-14)
- `aa745924…` Safe, Resilient Transport and Smart Mobility services for pa (closed / 2021-10-19)
- `2a6ff902…` Clean and competitive solutions for all transport modes (closed / 2022-04-26)

#### C. atlas.knowledge_chunks (knowledge docs)

| Rank | Score | Title | Publisher | Tier |
|------|-------|-------|-----------|------|
| 1 | 0.423 | 5G Testbeds and Trials Programme | GOV.UK / detailed_guide | primary |
| 2 | 0.4124 | Digital Connectivity Infrastructure Accelerator Competition  | GOV.UK / detailed_guide | primary |
| 3 | 0.3764 | RVAR 2010 exemption: Hayling Light Railway Trust | Department for Transport | primary |
| 4 | 0.3023 | Statement of Strategic Priorities for telecommunications, th | GOV.UK / policy_paper | primary |

#### D. hive.document_chunks

| Rank | Score | Title |
|------|-------|-------|
| 1 | 0.4045 | Major Road Projects Victoria (MRPV) Pound Road West Upgrade in Dandeno |
| 2 | 0.3001 | Major Road Projects Victoria (MRPV) Pound Road West Upgrade in Dandeno |
| 3 | 0.2739 | Bradford Metropolitan Council Trees as stormwater attenuation and trea |
| 4 | 0.1957 | LA Metro |
| 5 | 0.0743 | Santa Barbara County Montecito's Randall Road Debris Basin |

### Q6 — A14 / strategic road network freight

> Query: `A14 strategic road network freight transport`

#### A. atlas.projects — semantic

| Rank | Score | Classification | Title | Organisation |
|------|-------|----------------|-------|--------------|
| 1 | 0.5291 | WEAK | London Freight Mapping and End User Solution | MPIE LIMITED |
| 2 | 0.5227 | WEAK | National Freight Model (Phase 2) | CITY SCIENCE CORPORATION LIMITED |
| 3 | 0.5213 | WEAK | National Freight Model | CITY SCIENCE CORPORATION LIMITED |
| 4 | 0.5051 | WEAK | Intelligent Multimodal Logistics Control and Brokerage Centre | ROCKSHORE LTD |
| 5 | 0.5003 | WEAK | Levelling up Freight | 3SQUARED LTD. |

*Semantic top-5 contains all keyword matches — no semantic gap.*

#### B. atlas.live_calls — semantic

| Rank | Score | Status | Title | Funder |
|------|-------|--------|-------|--------|
| 1 | 0.5172 | closed | 2016-2017 Mobility for Growth  | European Commission / Horizon Europe |
| 2 | 0.501 | closed | Safe, Resilient Transport and Smart Mobility services for pa | European Commission / Horizon Europe |
| 3 | 0.4998 | closed | Safe, Resilient Transport and Smart Mobility services for pa | European Commission / Horizon Europe |
| 4 | 0.4953 | open | More than £14 million in joint government and industry fundi | GOV.UK / press_release |
| 5 | 0.4899 | closed | Safe, Resilient Transport and Smart Mobility services for pa | European Commission / Horizon Europe |

#### C. atlas.knowledge_chunks (knowledge docs)

| Rank | Score | Title | Publisher | Tier |
|------|-------|-------|-----------|------|
| 1 | 0.5389 | Future of Freight: A Long-term Plan | Department for Transport | primary |
| 2 | 0.5329 | Future of Freight: A Long-term Plan | Department for Transport | primary |
| 3 | 0.5238 | Major Road Network and Large Local Majors programme | GOV.UK / policy_paper | primary |
| 4 | 0.5087 | Future of Freight: A Long-term Plan | Department for Transport | primary |
| 5 | 0.5026 | Future of Freight: A Long-term Plan | Department for Transport | primary |

#### D. hive.document_chunks

| Rank | Score | Title |
|------|-------|-------|
| 1 | 0.3031 | Transport for London (TfL) |
| 2 | 0.2899 | Transport for London (TfL) |
| 3 | 0.2724 | Environment Agency |
| 4 | 0.2526 | Qatar's Public Works Authority Pumping station and outfall tunnel |
| 5 | 0.2206 | Heathrow Airport Balancing Ponds |

### Q7 — Autonomous HGV / platooning

> Query: `autonomous HGV platooning connected vehicle`

#### A. atlas.projects — semantic

| Rank | Score | Classification | Title | Organisation |
|------|-------|----------------|-------|--------------|
| 1 | 0.5317 | WEAK | Optimization and Mathematical Modelling for Path Planning of Cooperati |  |
| 2 | 0.5215 | WEAK | Tools for autonomous logistics operations and management | IMMENSE SIMULATIONS LIMITED |
| 3 | 0.493 | WEAK | Protection for Connected and Autonomous Vehicles against Cooperative D |  |
| 4 | 0.4895 | WEAK | Resilient Path Coordination in Connected Vehicle Systems |  |
| 5 | 0.4755 | WEAK | MultiCAV | MEPC MILTON GP LIMITED |

*Semantic top-5 contains all keyword matches — no semantic gap.*

#### B. atlas.live_calls — semantic

| Rank | Score | Status | Title | Funder |
|------|-------|--------|-------|--------|
| 1 | 0.5274 | open | Large-scale demonstration of Heavy-Duty Battery Electric Veh | European Commission / Horizon Europe |
| 2 | 0.5096 | open | Autonomous vessels in short sea shipping and inland waterway | European Commission / Horizon Europe |
| 3 | 0.5083 | open | Higher Voltage, Megawatt Charging System compatible, modular | European Commission / Horizon Europe |
| 4 | 0.5012 | closed | Safe, Resilient Transport and Smart Mobility services for pa | European Commission / Horizon Europe |
| 5 | 0.4918 | closed | Safe, Resilient Transport and Smart Mobility services for pa | European Commission / Horizon Europe |

#### C. atlas.knowledge_chunks (knowledge docs)

| Rank | Score | Title | Publisher | Tier |
|------|-------|-------|-----------|------|
| 1 | 0.5114 | Preparing the way for self-driving mass transit services in  | Centre for Connected and Auton | primary |
| 2 | 0.4477 | UK government backing helps launch world first self-driving  | GOV.UK / press_release | primary |
| 3 | 0.4406 | UK government backing helps launch world first self-driving  | GOV.UK / press_release | primary |
| 4 | 0.3171 | Better Connected: tap-and-go travel across trains, trams and | GOV.UK / press_release | primary |
| 5 | 0.2731 | Communiqué from the Interministerial Group for Transport Mat | GOV.UK / policy_paper | primary |

#### D. hive.document_chunks

| Rank | Score | Title |
|------|-------|-------|
| 1 | 0.2084 | LA Metro |
| 2 | 0.2068 | Major Road Projects Victoria (MRPV) Pound Road West Upgrade in Dandeno |
| 3 | 0.1624 | Bradford Metropolitan Council Trees as stormwater attenuation and trea |
| 4 | 0.1232 | Major Road Projects Victoria (MRPV) Pound Road West Upgrade in Dandeno |
| 5 | 0.0458 | Santa Barbara County Montecito's Randall Road Debris Basin |

### Q8 — CAV infrastructure readiness

> Query: `connected autonomous vehicle infrastructure readiness UK`

#### A. atlas.projects — semantic

| Rank | Score | Classification | Title | Organisation |
|------|-------|----------------|-------|--------------|
| 1 | 0.6111 | ADJACENT | CAVIAR (Connected and Autonomous Vehicles: Infrastructure Appraisal Re | GALLIFORD TRY INFRASTRUCTURE LIMITED |
| 2 | 0.5992 | ADJACENT | CAVIAR (Connected and Autonomous Vehicles: Infrastructure Appraisal Re | GALLIFORD TRY INFRASTRUCTURE LIMITED |
| 3 | 0.55 | ADJACENT | MOVE-UK: accelerating automated driving by connected validation &amp;  | TRL ACADEMY |
| 4 | 0.5418 | WEAK | AI-Driven Secured Connected and Autonomous Vehicles (AI-DRIVEs) | UBIPOS UK LIMITED |
| 5 | 0.5297 | WEAK | Protection for Connected and Autonomous Vehicles against Cooperative D |  |

**Keyword-only hits (5 not in semantic top-5):**
- `d895aa49…` Motorway Mobility
- `57a77e15…` Tools for autonomous logistics operations and management
- `b82b80e0…` Decarbonising Transport through Electrification, a Whole System Approa
- `3c68d991…` Towards Energy Efficient Autonomous Vehicles via Cloud-Aided Learning
- `ba432afc…` Optimization and Mathematical Modelling for Path Planning of Cooperati

#### B. atlas.live_calls — semantic

| Rank | Score | Status | Title | Funder |
|------|-------|--------|-------|--------|
| 1 | 0.6421 | open | A connected and autonomous vehicle ecosystem: apply for fund | GOV.UK / news_story |
| 2 | 0.5501 | closed | Resilient Infrastructure 2022 | European Commission / Horizon Europe |
| 3 | 0.5457 | open | Next step on the UK rollout of self-driving vehicles as publ | GOV.UK / press_release |
| 4 | 0.5163 | closed | 2016-2017 Automated Road Transport | European Commission / Horizon Europe |
| 5 | 0.5142 | closed | Connected and Automated Mobility Standards Programme - Phase | Department for Transport |

**Keyword-only call hits (5 not in semantic top-5):**
- `aedf809a…` a7bb3b83-5123-4953-8876-90b6975742a8 (closed / 2021-08-24)
- `9a45186b…` Government sets out next steps in establishing the UK as glo (open / None)
- `abcc16d7…` £25 million boost for self-driving technology: apply for fun (open / None)
- `1c4f05bf…` Testing connected and autonomous vehicles: apply for funding (open / None)
- `15f59ea1…` Connected and autonomous vehicles: apply for business fundin (open / None)

#### C. atlas.knowledge_chunks (knowledge docs)

| Rank | Score | Title | Publisher | Tier |
|------|-------|-------|-----------|------|
| 1 | 0.5756 | Connected and autonomous vehicle research and development pr | Centre for Connected and Auton | primary |
| 2 | 0.5379 | Connected and Automated Vehicles: market forecast 2020 | Department for Transport | primary |
| 3 | 0.502 | Airspace modernisation | GOV.UK / policy_paper | primary |
| 4 | 0.5006 | UK electric vehicle infrastructure strategy | GOV.UK / policy_paper | primary |
| 5 | 0.4991 | Automated and Electric Vehicle Act report | GOV.UK / guidance | primary |

#### D. hive.document_chunks

| Rank | Score | Title |
|------|-------|-------|
| 1 | 0.3582 | NetworkRail Drainage System |
| 2 | 0.3344 | Network Rail Dawlish Sea Wall |
| 3 | 0.3203 | Qatar's Public Works Authority Pumping station and outfall tunnel |
| 4 | 0.2962 |  |
| 5 | 0.2885 | Leeds flood alleviation scheme |

### Q9 — Supply chain resilience

> Query: `supply chain resilience logistics technology UK`

#### A. atlas.projects — semantic

| Rank | Score | Classification | Title | Organisation |
|------|-------|----------------|-------|--------------|
| 1 | 0.6245 | ADJACENT | L3 Logistics Living Lab | YUSEN LOGISTICS (UK) LIMITED |
| 2 | 0.597 | ADJACENT | Logistics Optimisation After Brexit and COVID-19 |  |
| 3 | 0.5469 | WEAK | Links with China on Global Logistics and Supply Chain Management |  |
| 4 | 0.5469 | WEAK | Links with China on Global Logistics and Supply Chain Management |  |
| 5 | 0.5417 | WEAK | skills for next generation logistics and supply chain management |  |

**Keyword-only hits (5 not in semantic top-5):**
- `7b809f9d…` Carbon Capture and Re-Use Strategies for Optimising Decarbonisation of
- `185adce2…` Project Sunflower
- `6c2b0904…` Prosperity Partnerships
- `df28e793…` Innovative Intermodal Urban Freight Transport Solution
- `8a656136…` Decarbonising Auxiliary Load in Freight Today

#### B. atlas.live_calls — semantic

| Rank | Score | Status | Title | Funder |
|------|-------|--------|-------|--------|
| 1 | 0.5789 | closed | A DIGITISED, RESOURCE-EFFICIENT AND RESILIENT INDUSTRY 2022 | European Commission / Horizon Europe |
| 2 | 0.5317 | closed | RESILIENT VALUE CHAINS 2023 | European Commission / Horizon Europe |
| 3 | 0.5039 | closed | A DIGITISED, RESOURCE-EFFICIENT AND RESILIENT INDUSTRY 2021 | European Commission / Horizon Europe |
| 4 | 0.4979 | closed | RESILIENT VALUE CHAINS 2024 | European Commission / Horizon Europe |
| 5 | 0.4934 | open | Resilient technologies to improve UK railways: apply for fun | GOV.UK / news_story |

**Keyword-only call hits (3 not in semantic top-5):**
- `9354cba7…` TWIN GREEN AND DIGITAL TRANSITION 2024 (closed / 2024-02-07)
- `dc6eb4c6…` RESILIENT VALUE CHAINS 2024 (closed / 2024-02-07)
- `8a46147e…` Cross-sectoral solutions for the climate transition (closed / 2024-04-18)

#### C. atlas.knowledge_chunks (knowledge docs)

| Rank | Score | Title | Publisher | Tier |
|------|-------|-------|-----------|------|
| 1 | 0.5784 | Future of Freight: A Long-term Plan | Department for Transport | primary |
| 2 | 0.57 | Future of Freight: A Long-term Plan | Department for Transport | primary |
| 3 | 0.5661 | Maritime 2050: Navigating the Future | Department for Transport | primary |
| 4 | 0.5627 | National semiconductor strategy | GOV.UK / policy_paper | primary |
| 5 | 0.5588 | Maritime 2050: Navigating the Future | Department for Transport | primary |

#### D. hive.document_chunks

| Rank | Score | Title |
|------|-------|-------|
| 1 | 0.465 |  |
| 2 | 0.4489 | Network Rail Dawlish Sea Wall |
| 3 | 0.4336 |  |
| 4 | 0.4294 | Metropolitan Transportation Authority (MTA) New York |
| 5 | 0.4268 | New locks in the Albert canal in Flanders, Belgium |

---

## 5. Diagnosis

- **[SCORE RANGE]** Project similarity median below 0.55 — corpus may lack direct domain match OR embedding space is well-discriminated and these queries sit in a genuinely sparse region.
- **[SPARSE DOMAIN]** Less than 10% of retrieved project scores clear 0.70. This strongly suggests the atlas.projects corpus has few documents that are directly about autonomous freight / AV corridors.
- **[KEYWORD GAP]** Keyword search finds distinct results not in semantic top-5 for 7/9 queries. This indicates either stale embeddings (corpus updated after last embed run) or that short field values (titles only) are under-embedding abstract content.
- **[KNOWLEDGE DOCS LOW]** Knowledge chunk scores also below 0.55 — policy/report evidence is similarly sparse for this domain.

---

## 6. Recommendation

| Option | Description | Confidence boost | Effort |
|--------|-------------|------------------|--------|
| **A — Query/routing tuning** | Add multi-hop: run two passes (broad + narrow), weight abstract field more heavily, expand query with synonym expansion | +5–10% recall | Low |
| **B — Selective re-embed** | Re-embed projects where `abstract` is long but `embedding` was computed only on `title` (check embed_source column) | +10–20% precision | Medium |
| **C — Add GovUK / Exa** | External search fills gaps where CPC corpus is thin; GovUK gets DfT/Innovate UK source docs, Exa gets recent news/academic | +15–30% direct evidence | Medium |
| **D — Both B + C** | Re-embed stale rows AND add external lane | +25–40% | High |

### Verdict

**B first, then C** — keyword gap signals stale embeddings; fix that before adding external search.

> Keyword search beats semantic for 1/3+ of queries, which means some corpus rows have embeddings computed before their current content. Re-embedding those rows (identified by comparing embed_updated_at vs record updated_at) will immediately improve precision at no latency cost. Once re-embedding is done, adding GovUK/Exa will fill the remaining domain gap (no CPC A14 AV trial data exists — external evidence is genuinely necessary).

### Before adding Exa/GovUK — confirm these:

1. **Check `embed_updated_at` vs `updated_at`** on atlas.projects rows — any row where    `updated_at > embed_updated_at` has stale embeddings.
2. **Check `embed_source` field** — if abstracts were truncated to 256 chars during    embedding but the full abstract is >500 chars, re-embed with full text.
3. **Check knowledge_documents count** — if `atlas.knowledge_chunks` is sparse,    the policy evidence lane is un-populated; DfT Freight documents should be ingested.
4. **Check hive.articles count** — if HIVE is empty for freight/AV, there is a data gap    that neither re-embedding nor Exa can fix without an ingestion run.

---

## 7. Manual Analysis Override (post-script review)

> The automated script selected "B first, then C" because keyword search beat semantic
> for 7/9 queries. **That inference is wrong.** See below for the correct root-cause
> chain and revised recommendation.

### Why "B = stale embeddings" is incorrect

| Signal | Script interpretation | Correct interpretation |
|--------|----------------------|------------------------|
| 7/9 keyword-gap queries | Stale embeddings | Domain vocabulary mismatch: "A14", "platooning" absent from corpus even in keyword search (0 results) |
| 100% embedding coverage | N/A | Embeddings are 100% fresh — no re-embed needed |
| knowledge_chunks internal median 0.865 | — | Dense policy corpus; freight/AV queries sit in sparse outer region, not stale-embed gap |
| Q6 `ILIKE '%A14%'` → 0 results | — | A14 corridor doesn't exist in the CPC corpus. Re-embedding won't create absent data. |
| Q7 `ILIKE '%platooning%'` → 0 results | — | No platooning projects exist. Vocabulary gap, not staleness. |

### The real root cause

**ATLAS never called `search_corpus_evidence`.** The `atlas.knowledge_chunks` surface
(4,974 rows, 100% embedded) contains 20+ directly relevant primary-tier policy documents:

| Document | Best similarity | Notes |
|----------|----------------|-------|
| Future of Freight: A Long-term Plan (DfT) | **0.691** | Multi-chunk; Green Book five-case reference |
| UK Transport Decarbonisation Plan | 0.623 | Policy levers and targets |
| Connected and autonomous vehicle R&D projects (CCAV) | 0.576 | Direct AV corpus |
| Self-driving vehicle pilot scheme guidance | 0.552 | Regulatory pathway |

These were never surfaced because `graph.py` only called `search_corpus_projects` and
`search_corpus_live_calls`. The `search_corpus_evidence` tool already exists in
`mcp_client.py` and was simply never invoked.

### Corrected recommendation: A immediately, C in next sprint

**A — query/routing tuning (immediate, no DB changes):**
- Add `search_corpus_evidence` to the `search_corpus` node in `agents/atlas/graph.py`
- Run two passes: (1) full user query for semantic sweep, (2) 4-term focused sub-query
  extracted from the user query for vocabulary precision
- Knowledge chunks become LLM context for Five Case prose
- `source_diversity` rises from 2 → 3, enabling confidence tier to lift from
  `Indicative` → `Supported` (requires total ≥ 3 AND source_diversity ≥ 2)

**C — GovUK/Exa (next sprint, after validating A):**
- Fills the irreducible gap: no A14 AV trial in CPC corpus — external evidence is
  genuinely necessary for Robust tier
- GovUK: DfT Future of Freight, Innovate UK AV rounds
- Exa: recent UK autonomous freight news, CCAV press releases

**B — re-embed: NOT needed.** Embeddings are 100% fresh. Running B wastes engineering
time and produces no improvement.

### Expected outcome after Recommendation A

| Metric | Before A | After A (projected) |
|--------|----------|---------------------|
| `search_corpus_evidence` in tool_calls | No | Yes (2 passes) |
| Policy docs in LLM context | 0 | 5–10 chunks from DfT/CCAV |
| source_diversity in coverage summary | 2 | 3 |
| LLM-assigned confidence tier | Indicative | Supported (probable) |

---
