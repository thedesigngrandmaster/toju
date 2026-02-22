import { Schema, model, Document } from 'mongoose'
export interface IHospital extends Document {
  name: string
  address?: string
  createdAt: Date
}
const HospitalSchema = new Schema<IHospital>(
  {
    name:    { type: String, required: true },
    address: String,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
      },
    },
  }
)
export const Hospital = model<IHospital>('Hospital', HospitalSchema)
