import { supabase, Product, WebhookData, Founder } from './supabase'

export class ProductDatabase {
  // Get all products
  static async getAllProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching products:', error)
      throw error
    }

    return data || []
  }

  // Get products by industry
  static async getProductsByIndustry(industry: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('industry', industry)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching products by industry:', error)
      throw error
    }

    return data || []
  }

  // Get product by selection criteria
  static async getProductBySelection(
    industry: string,
    brandName: string,
    chemicalName: string
  ): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('industry', industry)
      .eq('brandName', brandName)
      .eq('chemicalName', chemicalName)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null
      }
      console.error('Error fetching product by selection:', error)
      throw error
    }

    return data
  }

  // Insert new product
  static async insertProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single()

    if (error) {
      console.error('Error inserting product:', error)
      throw error
    }

    return data
  }

  // Update existing product
  static async updateProduct(
    id: string,
    updates: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating product:', error)
      throw error
    }

    return data
  }

  // Delete product
  static async deleteProduct(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting product:', error)
      throw error
    }

    return true
  }

  // Get unique industries
  static async getIndustries(): Promise<string[]> {
    const { data, error } = await supabase
      .from('products')
      .select('industry')
      .order('industry')

    if (error) {
      console.error('Error fetching industries:', error)
      throw error
    }

    return Array.from(new Set(data?.map((item: { industry: string }) => item.industry) || []))
  }

  // Get brands by industry
  static async getBrandsByIndustry(industry: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('products')
      .select('brandName')
      .eq('industry', industry)
      .order('brandName')

    if (error) {
      console.error('Error fetching brands by industry:', error)
      throw error
    }

    return Array.from(new Set(data?.map((item: { brandName: string }) => item.brandName) || []))
  }

  // Get chemicals by brand
  static async getChemicalsByBrand(industry: string, brandName: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('products')
      .select('chemicalName')
      .eq('industry', industry)
      .eq('brandName', brandName)
      .order('chemicalName')

    if (error) {
      console.error('Error fetching chemicals by brand:', error)
      throw error
    }

    return Array.from(new Set(data?.map((item: { chemicalName: string }) => item.chemicalName) || []))
  }

  // Get countries by selection
  static async getCountriesBySelection(
    industry: string,
    brandName: string,
    chemicalName: string
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('products')
      .select('targetCountries')
      .eq('industry', industry)
      .eq('brandName', brandName)
      .eq('chemicalName', chemicalName)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return []
      }
      console.error('Error fetching countries by selection:', error)
      throw error
    }

    return data?.targetCountries || []
  }
}

export class WebhookDatabase {
  // Insert webhook data
  static async insertWebhookData(webhookData: Omit<WebhookData, 'id' | 'created_at' | 'processed_at'>): Promise<WebhookData | null> {
    const { data, error } = await supabase
      .from('webhook_data')
      .insert([{
        ...webhookData,
        processed_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Error inserting webhook data:', error)
      throw error
    }

    return data
  }

  // Get all webhook data
  static async getAllWebhookData(): Promise<WebhookData[]> {
    const { data, error } = await supabase
      .from('webhook_data')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching webhook data:', error)
      throw error
    }

    return data || []
  }

  // Get webhook data by date range
  static async getWebhookDataByDateRange(startDate: string, endDate: string): Promise<WebhookData[]> {
    const { data, error } = await supabase
      .from('webhook_data')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching webhook data by date range:', error)
      throw error
    }

    return data || []
  }
}

export class FounderDatabase {
  // Helper function to fetch all data with pagination
  private static async fetchAllWithPagination<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createQuery: () => { range: (from: number, to: number) => any },
    batchSize: number = 1000
  ): Promise<T[]> {
    const allData: T[] = []
    let from = 0
    let hasMore = true

    while (hasMore) {
      // Create a fresh query for each batch
      const queryBuilder = createQuery()
      const { data, error } = await queryBuilder.range(from, from + batchSize - 1)

      if (error) {
        throw error
      }

      if (data && data.length > 0) {
        allData.push(...data)
        from += batchSize
        hasMore = data.length === batchSize // Continue if we got a full batch
      } else {
        hasMore = false
      }
    }

    return allData
  }

  // Get all founders
  static async getAllFounders(): Promise<Founder[]> {
    try {
      const createQuery = () => supabase
        .from('scraped Data')
        .select('*')
        .order('created_at', { ascending: false })

      const data = await this.fetchAllWithPagination<Founder>(createQuery)
      
      console.log(`✅ Fetched all ${data.length} founders from database`)
      return data
    } catch (error) {
      console.error('Error fetching founders:', error)
      throw error
    }
  }

  // Get founders by industry
  static async getFoundersByIndustry(industry: string): Promise<Founder[]> {
    try {
      console.log('🔍 Fetching founders for industry:', industry)
      
      // Fetch all founders first using pagination
      const createQuery = () => supabase
        .from('scraped Data')
        .select('*')
        .order('created_at', { ascending: false })

      const allData = await this.fetchAllWithPagination<Founder>(createQuery)
      console.log('📊 Total founders fetched:', allData.length)

      // Filter by industry in JavaScript (to handle column name with apostrophe)
      const filtered = allData.filter((founder: Founder) => {
        const founderIndustry = founder["Company's Industry"]
        if (!founderIndustry || typeof founderIndustry !== 'string') {
          return false
        }
        // Case-insensitive partial match
        return founderIndustry.toLowerCase().includes(industry.toLowerCase())
      })

      console.log('✅ Filtered founders:', filtered.length, 'for industry:', industry)
      return filtered
    } catch (error) {
      console.error('❌ Exception in getFoundersByIndustry:', error)
      throw error
    }
  }

  // Get founders by verification status
  static async getFoundersByVerification(verified: boolean): Promise<Founder[]> {
    try {
      const createQuery = () => supabase
        .from('scraped Data')
        .select('*')
        .eq('Verification', verified)
        .order('created_at', { ascending: false })

      const data = await this.fetchAllWithPagination<Founder>(createQuery)
      console.log(`✅ Fetched ${data.length} founders with verification: ${verified}`)
      return data
    } catch (error) {
      console.error('Error fetching founders by verification:', error)
      throw error
    }
  }

  // Get founders by mail status
  static async getFoundersByMailStatus(status: string): Promise<Founder[]> {
    try {
      const createQuery = () => supabase
        .from('scraped Data')
        .select('*')
        .eq('Mail Status', status)
        .order('created_at', { ascending: false })

      const data = await this.fetchAllWithPagination<Founder>(createQuery)
      console.log(`✅ Fetched ${data.length} founders with mail status: ${status}`)
      return data
    } catch (error) {
      console.error('Error fetching founders by mail status:', error)
      throw error
    }
  }

  // Get unique industries from founders
  static async getFounderIndustries(): Promise<string[]> {
    try {
      // Fetch all founders using pagination to get all industries
      const createQuery = () => supabase
        .from('scraped Data')
        .select('*')  // Select all fields first, then extract the industry column

      const allData = await this.fetchAllWithPagination<Founder>(createQuery)
      console.log('📊 Raw data from Supabase:', allData.length, 'records')

      // Get unique industries (stored as text, not array)
      const industries = new Set<string>()
      allData.forEach((founder: Founder) => {
        const industry = founder["Company's Industry"]
        if (industry && typeof industry === 'string' && industry.trim()) {
          // Filter out old JSON array format (e.g., ["oil & energy"])
          // Only keep clean text format (e.g., "Oil & Gas", "Agrochemical", "Lubricant")
          if (!industry.startsWith('[')) {
            industries.add(industry.trim())
          }
        }
      })

      const result = Array.from(industries).sort()
      console.log('✅ Unique industries found:', result.length, 'industries')
      return result
    } catch (error) {
      console.error('❌ Exception in getFounderIndustries:', error)
      throw error
    }
  }

  // Insert new founder
  static async insertFounder(founderData: Omit<Founder, 'id' | 'created_at' | 'updated_at'>): Promise<Founder | null> {
    const { data, error } = await supabase
      .from('scraped Data')
      .insert([founderData])
      .select()
      .single()

    if (error) {
      console.error('Error inserting founder:', error)
      throw error
    }

    return data
  }

  // Update founder
  static async updateFounder(id: string, updates: Partial<Omit<Founder, 'id' | 'created_at'>>): Promise<Founder | null> {
    const { data, error } = await supabase
      .from('scraped Data')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating founder:', error)
      throw error
    }

    return data
  }

  // Delete founder
  static async deleteFounder(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('scraped Data')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting founder:', error)
      throw error
    }

    return true
  }

  // Get founders by date range
  static async getFoundersByDateRange(startDate: string, endDate: string): Promise<Founder[]> {
    try {
      const createQuery = () => supabase
        .from('scraped Data')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })

      const data = await this.fetchAllWithPagination<Founder>(createQuery)
      console.log(`✅ Fetched ${data.length} founders in date range: ${startDate} to ${endDate}`)
      return data
    } catch (error) {
      console.error('Error fetching founders by date range:', error)
      throw error
    }
  }
}

export class EmailTimerDatabase {
  // Get email send timestamp for a user
  static async getEmailSendTimestamp(userEmail: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('email_send_timestamps')
      .select('last_send_timestamp')
      .eq('user_email', userEmail)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found, return null (no timer active)
        return null
      }
      console.error('Error fetching email send timestamp:', error)
      throw error
    }

    return data?.last_send_timestamp || null
  }

  // Set email send timestamp for a user
  static async setEmailSendTimestamp(userEmail: string, timestamp: number): Promise<boolean> {
    const { data, error } = await supabase
      .from('email_send_timestamps')
      .upsert({
        user_email: userEmail,
        last_send_timestamp: timestamp,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_email'
      })
      .select()
      .single()

    if (error) {
      console.error('Error setting email send timestamp:', error)
      throw error
    }

    return !!data
  }

  // Clear email send timestamp for a user (optional, for manual reset)
  static async clearEmailSendTimestamp(userEmail: string): Promise<boolean> {
    const { error } = await supabase
      .from('email_send_timestamps')
      .update({
        last_send_timestamp: 0,
        updated_at: new Date().toISOString()
      })
      .eq('user_email', userEmail)

    if (error) {
      console.error('Error clearing email send timestamp:', error)
      throw error
    }

    return true
  }
}
