/**
 * Delivery Reminder Job
 * 
 * Sends SMS reminders to trainers 24 hours before scheduled product deliveries.
 */

import * as db from "../db";
import { sendDeliveryReminderSms } from "../_core/sms";

export interface DeliveryReminderResult {
  success: boolean;
  message: string;
  remindersChecked: number;
  remindersSent: number;
  remindersFailed: number;
  details: Array<{
    deliveryId: number;
    trainerName: string;
    productName: string;
    clientName: string;
    scheduledDate: string;
    smsSent: boolean;
    error?: string;
  }>;
}

/**
 * Check for deliveries scheduled within the next 24-28 hours and send SMS reminders
 * The 4-hour window ensures we catch deliveries even if the cron runs slightly late
 */
export async function sendDeliveryReminders(): Promise<DeliveryReminderResult> {
  const result: DeliveryReminderResult = {
    success: true,
    message: "",
    remindersChecked: 0,
    remindersSent: 0,
    remindersFailed: 0,
    details: [],
  };

  try {
    // Get all pending deliveries
    const pendingDeliveries = await db.getAllPendingDeliveries();
    
    const now = new Date();
    const minTime = new Date(now.getTime() + 20 * 60 * 60 * 1000); // 20 hours from now
    const maxTime = new Date(now.getTime() + 28 * 60 * 60 * 1000); // 28 hours from now
    
    // Filter deliveries scheduled within the reminder window
    const deliveriesToRemind = pendingDeliveries.filter((d: typeof pendingDeliveries[0]) => {
      if (!d.scheduledDate) return false;
      const scheduled = new Date(d.scheduledDate);
      return scheduled >= minTime && scheduled <= maxTime;
    });
    
    result.remindersChecked = deliveriesToRemind.length;
    
    if (deliveriesToRemind.length === 0) {
      result.message = "No deliveries scheduled for tomorrow";
      return result;
    }
    
    // Send reminders for each delivery
    for (const delivery of deliveriesToRemind) {
      const detail: DeliveryReminderResult["details"][0] = {
        deliveryId: delivery.id,
        trainerName: delivery.trainerName || "Trainer",
        productName: delivery.productName,
        clientName: delivery.clientName || "Client",
        scheduledDate: delivery.scheduledDate!.toISOString(),
        smsSent: false,
      };
      
      try {
        // Get trainer's phone number
        const trainer = await db.getUserById(delivery.trainerId);
        
        if (!trainer?.phone) {
          detail.error = "Trainer has no phone number on file";
          result.remindersFailed++;
          result.details.push(detail);
          continue;
        }
        
        // Send SMS reminder
        const sent = await sendDeliveryReminderSms(
          trainer.phone,
          trainer.name || "Trainer",
          delivery.productName,
          delivery.clientName || "Client",
          new Date(delivery.scheduledDate!)
        );
        
        if (sent) {
          detail.smsSent = true;
          result.remindersSent++;
          
          // Log the reminder activity
          await db.logActivity({
            userId: delivery.trainerId,
            action: "delivery_reminder_sent",
            entityType: "product_delivery",
            entityId: delivery.id,
            details: {
              productName: delivery.productName,
              clientName: delivery.clientName,
              scheduledDate: delivery.scheduledDate,
              channel: "sms",
            },
          });
        } else {
          detail.error = "SMS send failed";
          result.remindersFailed++;
        }
      } catch (error) {
        detail.error = error instanceof Error ? error.message : "Unknown error";
        result.remindersFailed++;
      }
      
      result.details.push(detail);
    }
    
    result.message = `Sent ${result.remindersSent} of ${result.remindersChecked} delivery reminders`;
    
  } catch (error) {
    result.success = false;
    result.message = error instanceof Error ? error.message : "Unknown error";
  }
  
  return result;
}
