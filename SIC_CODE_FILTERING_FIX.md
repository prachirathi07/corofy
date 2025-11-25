# SIC Code Filtering Fix

## Problem
Leads were being scraped from incorrect industries even when SIC codes were specified. For example, SIC code 2879 (Agrochemical industries) was returning leads from other industries like "nonprofit organization management", "computer & network security", etc.

## Root Causes

1. **Invalid API Parameter**: The code was sending `_industry_filter` which is not a valid Apollo API parameter. This may have been interfering with SIC code filtering.

2. **No Post-Validation**: After receiving results from Apollo, the code wasn't validating that returned leads actually matched the requested SIC codes.

3. **Empty SIC Code Array**: The code was sending `sic_codes or []` which could send an empty array if `sic_codes` was `None`, potentially causing Apollo to ignore the filter.

## Fixes Applied

### 1. Removed Invalid `_industry_filter` Parameter
**Before:**
```python
payload = {
    ...
    "organization_sic_codes": sic_codes or [],
    "_industry_filter": industry,  # ❌ Not a valid Apollo API parameter
    ...
}
```

**After:**
```python
payload = {
    ...
    # Only add organization_sic_codes if provided
    ...
}
# Remove _industry_filter - it's not a valid Apollo API parameter
```

### 2. Conditional SIC Code Addition
**Before:**
```python
"organization_sic_codes": sic_codes or [],  # Could send empty array
```

**After:**
```python
# CRITICAL: Only add organization_sic_codes if provided
if sic_codes and len(sic_codes) > 0:
    payload["organization_sic_codes"] = sic_codes
    logger.info(f"🔍 Apollo Search Page {page}: Filtering by SIC codes: {sic_codes}")
else:
    logger.warning(f"⚠️ Apollo Search Page {page}: No SIC codes provided!")
```

### 3. Post-Validation Filtering
Added validation after receiving results to ensure they match SIC codes:

```python
# VALIDATION: Filter results to ensure they match SIC codes
if sic_codes and len(sic_codes) > 0:
    filtered_people = []
    for person in people:
        org = person.get("organization", {})
        org_sic_codes = org.get("sic_codes", [])
        # Check if organization has any of the requested SIC codes
        if org_sic_codes and any(str(sic) in [str(s) for s in org_sic_codes] for sic in sic_codes):
            filtered_people.append(person)
        else:
            logger.warning(f"⚠️ Filtered out lead {person.get('name')} - SIC codes {org_sic_codes} don't match {sic_codes}")
    people = filtered_people
    logger.info(f"✅ After SIC code validation: {len(people)} leads match SIC codes {sic_codes}")
```

### 4. Enhanced Logging
- Added logging to show which SIC codes are being used
- Added warning if no SIC codes are provided
- Added debug logging for the full payload
- Added validation logging showing how many leads match after filtering

## Expected Behavior

1. **SIC Codes Provided**: 
   - Only `organization_sic_codes` is sent to Apollo API
   - Results are validated to ensure they match the SIC codes
   - Leads that don't match are filtered out with a warning

2. **No SIC Codes Provided**:
   - Warning is logged
   - Search proceeds without SIC code filtering
   - All results are returned (may not be industry-specific)

## Testing

To verify the fix works:

1. **Test with SIC Code 2879 (Agrochemical)**:
   ```python
   sic_codes = ["2879"]
   ```
   - Should only return leads from agrochemical companies
   - Check logs for "Filtering by SIC codes: ['2879']"
   - Check logs for validation results

2. **Check Logs**:
   - Look for: `🔍 Apollo Search Page X: Filtering by SIC codes: ['2879']`
   - Look for: `✅ After SIC code validation: X leads match SIC codes ['2879']`
   - Look for warnings: `⚠️ Filtered out lead...` if any leads don't match

## Files Changed

- `app/services/apollo_service.py`:
  - `_search_people_basic()` method - Fixed payload building and added validation
  - Both occurrences of payload building were fixed (there are two search methods)

## Notes

- The `industry` parameter is still accepted but no longer sent to Apollo API
- Industry filtering should be done exclusively via SIC codes
- The validation step ensures that even if Apollo returns incorrect results, they are filtered out

