# Nigerian Heritage Theme

**Purpose:** Single reference for the Nigerian heritage color palette used across the MediForge application.

---

## Color Palette

| Variable | Hex | Description |
|----------|-----|-------------|
| `--primary-green` | `#008753` | Nigerian flag green – primary brand, buttons, headings |
| `--dark-green` | `#006b42` | Darker green – gradients, hover states |
| `--nigerian-white` | `#FFFFFF` | Pure white – cards, content backgrounds |
| `--kente-gold` | `#DAA520` | Kente cloth gold – accents, borders, highlights |
| `--adire-blue` | `#4169E1` | Adire indigo blue – secondary actions, links |
| `--coral` | `#FF7F50` | Coral accent – alerts, emphasis |
| `--ivory` | `#FFFFF0` | Ivory/cream – page backgrounds |
| `--warm-gray` | `#F5F5DC` | Beige/warm gray – gradient fills |
| `--charcoal` | `#36454F` | Dark gray – body text |
| `--soft-white` | `#FAFAFA` | Off-white – section backgrounds |

---

## CSS Variables (Copy-Paste Ready)

```css
:root {
  --primary-green: #008753;
  --dark-green: #006b42;
  --nigerian-white: #FFFFFF;
  --kente-gold: #DAA520;
  --adire-blue: #4169E1;
  --coral: #FF7F50;
  --ivory: #FFFFF0;
  --warm-gray: #F5F5DC;
  --charcoal: #36454F;
  --soft-white: #FAFAFA;
}
```

---

## Usage Guidelines

- **Primary actions:** `--primary-green`
- **Secondary actions / links:** `--adire-blue`
- **Accents & borders:** `--kente-gold`
- **Page background gradients:** `--ivory`, `--warm-gray`, `--soft-white`
- **Cards & content:** `--nigerian-white`
- **Body text:** `--charcoal`
- **Alerts / emphasis:** `--coral` or `--primary-green`

---

## Example Gradients

- **Page background:** `linear-gradient(135deg, var(--ivory) 0%, var(--warm-gray) 50%, var(--soft-white) 100%)`
- **Heading text:** `linear-gradient(135deg, var(--primary-green), var(--dark-green), var(--kente-gold))`
- **Button hover:** `linear-gradient(135deg, var(--dark-green), var(--primary-green))`

---

## Where Applied

The theme is used across BP alerts, admissions, clinical notes, blood pressure check notes, pharmacy dashboard, dashboard, patient details, and other pages. See inline `:root` blocks in those HTML files.
