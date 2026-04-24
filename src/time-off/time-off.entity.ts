// time-off.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Represents a time-off request submitted by an employee.
 * Stores request details such as requested dates, number of days, and current status.
 */
@Entity('time_off_requests')
@Index(['employeeId'])
@Index(['locationId'])
export class TimeOffRequest {
  /**
   * Unique identifier for the time-off request.
   * Generated as a UUID primary key.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifier of the employee requesting time off.
   * Indexed for faster lookups by employee.
   */
  @Column({ type: 'text', nullable: false })
  employeeId: string;

  /**
   * Identifier of the location where the employee works.
   * Indexed for location-based filtering.
   */
  @Column({ type: 'text', nullable: false })
  locationId: string;

  /**
   * Start date of the time-off period in ISO 8601 format (YYYY-MM-DD).
   */
  @Column({ type: 'text', nullable: false })
  startDate: string;

  /**
   * End date of the time-off period in ISO 8601 format (YYYY-MM-DD).
   */
  @Column({ type: 'text', nullable: false })
  endDate: string;

  /**
   * Number of days requested (e.g., 2.5 for half-day requests).
   * Stored as a decimal with 2 decimal places for fractional days.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  daysRequested: number;

  /**
   * Current status of the request.
   * Possible values: PENDING, APPROVED, REJECTED, CANCELLED.
   * Defaults to PENDING when a new request is created.
   */
  @Column({
    type: 'simple-enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING',
    nullable: false,
  })
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  /**
   * Timestamp when the request was created.
   * Automatically set by TypeORM.
   */
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  /**
   * Timestamp when the request was last updated.
   * Automatically updated by TypeORM.
   */
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}