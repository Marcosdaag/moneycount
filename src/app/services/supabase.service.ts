import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface Transaction {
  id?: string;
  created_at?: string;
  type: 'ingreso' | 'egreso';
  amount: number;
  payment_method: 'efectivo' | 'tarjeta' | 'transferencia';
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async addTransaction(transaction: Transaction) {
    const { data, error } = await this.supabase
      .from('transactions')
      .insert([transaction]);
    
    if (error) throw error;
    return data;
  }

  async getTransactions(startDate?: string, endDate?: string) {
    let query = this.supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Transaction[];
  }

  async deleteTransaction(id: string) {
    const { error } = await this.supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async updateTransactionAmount(id: string, amount: number) {
    const { error } = await this.supabase
      .from('transactions')
      .update({ amount })
      .eq('id', id);
    if (error) throw error;
  }

  subscribeToTransactions(callback: () => void) {
    const channel = this.supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          callback();
        }
      )
      .subscribe();
      
    return channel;
  }
}
