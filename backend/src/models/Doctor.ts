import { Schema, model, Document, Types } from 'mongoose'

export interface IDoctor extends Document {
  hospitalId: Types.ObjectId
  name: string
  specialty: string
  email: string
  passwordHash: string
  refreshTokenHash: string | null
  createdAt: Date
  updatedAt: Date
}

const DoctorSchema = new Schema<IDoctor>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    name: { type: String, required: true },
    specialty: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    refreshTokenHash: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
        delete ret.passwordHash
        delete ret.refreshTokenHash
      },
    },
  }
)

export const Doctor = model<IDoctor>('Doctor', DoctorSchema)
