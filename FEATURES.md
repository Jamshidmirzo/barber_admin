# Barber Admin — Feature List

## Roles

| Role | Access |
|------|--------|
| **Owner / Admin** | All sections |
| **Barber (Master)** | Services, Appointments, Clients (own), Schedule (own), Profile |

---

## Screens

### 1. Barbers *(Owner only)*
- Team list: avatar, name, phone, status (active / blocked)
- Per-barber stats: revenue, appointment count, hours worked
- Create new barber: name, last name, phone, password → show password with copy button
- Search existing user by phone and invite to team
- Barber profile page (separate screen)

### 2. Services *(All)*
- List of all services across all barbers
- Filter by barber
- Categories: Haircut, Beard, Coloring, Treatment, Other
- Each service: name, price (UZS), duration (min)

### 3. Appointments *(All)*
- Day view with prev / next day navigation
- Statuses: Pending / Scheduled / Confirmed / In Progress / Completed / Cancelled / No-show
- Each card: client name, service name, time slot

### 4. Clients *(All, role-dependent)*
**Owner:**
- Full CRM list: visit count, total spent, last visit date
- Loyalty badges: Gold / Silver client
- Search, add client, export to CSV
- Client profile page (separate screen)

**Barber:**
- Own clients only

### 5. Analytics *(Owner only)*
- Heatmap: day × hour grid showing appointment count and revenue
- Peak and slowest days / hours highlighted
- Weekly trend charts: revenue + appointment count
- Average check, growth vs previous period (%)
- AI promo suggestions: Claude generates promotion ideas based on slow slots

### 6. Schedule *(All, role-dependent)*
**Owner:**
- Team grid: days × barbers
- Slot states: free / booked / blocked
- Day summary: revenue, total appointments

**Barber:**
- Personal schedule editor
- Set working hours per day of week
- Block individual slots, mark day off

### 7. Finance *(Owner only)*
- Period switcher: Week / Month / Year
- Total revenue, appointment count (total / completed)
- New vs returning clients
- Top services by count and revenue
- Appointments-per-day bar chart
- Delta vs previous period (%)

### 8. Site — AI Generator *(Owner only)*
3-step wizard:
1. Salon name, address, phone, services list
2. Free-text description + style picker (Modern / Classic / Luxury / Minimal)
3. Result preview + link to public site (`slug.hayrli.app`)

Claude generates unique copy and a custom color palette for each salon.

### 9. Site Settings *(Owner only)*
- Edit: name, tagline, description, phone, address
- Style picker (Modern / Classic / Luxury / Minimal)
- Upload / delete cover photo
- Working hours per day (each day individually, can mark as closed)
- Services list for public site (name + description per service)

### 10. Profile *(All)*
- Name, last name, phone
- City, bio, specializations

---

## Auth Screens

- Login: phone + password
- Registration
- Onboarding: create salon on first login
