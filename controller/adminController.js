const User = require("../model/User")
const Request = require("../model/Request")
const Mail = require("../model/Mail")

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, "-password").sort({ createdAt: -1 })

        // Har bir foydalanuvchi uchun so'rovlar sonini hisoblash
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                const requestCount = await Request.countDocuments({ userId: user._id })
                const activeRequestCount = await Request.countDocuments({
                    userId: user._id,
                    status: { $in: ['pending', 'confirmed', 'inprogress'] }
                })

                return {
                    ...user.toObject(),
                    requestCount,
                    activeRequestCount,
                    canMakeUsta: requestCount === 0 && user.role === 'user'
                }
            })
        )

        res.json(usersWithStats)
    } catch (err) {
        console.error("Get all users error:", err)
        res.status(500).json({ msg: "Foydalanuvchilar ro'yxatini olishda xatolik yuz berdi" })
    }
}

exports.makeUsta = async (req, res) => {
    const { userId } = req.params

    try {
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ msg: "Foydalanuvchi topilmadi" })
        }

        // Check if user is already usta or admin
        if (user.role === "usta") {
            return res.status(400).json({ msg: "Foydalanuvchi allaqachon usta" })
        }

        if (user.role === "admin") {
            return res.status(400).json({ msg: "Admin rolini o'zgartirib bo'lmaydi" })
        }

        // Foydalanuvchining faol so'rovlarini tekshirish
        const activeRequests = await Request.find({
            userId: user._id,
            status: { $in: ['pending', 'confirmed', 'inprogress'] }
        })

        if (activeRequests.length > 0) {
            return res.status(400).json({
                msg: "Foydalanuvchini usta qilish mumkin emas",
                reason: "Foydalanuvchining faol so'rovlari mavjud",
                details: {
                    activeRequestsCount: activeRequests.length,
                    activeRequests: activeRequests.map(req => ({
                        id: req._id,
                        name: req.requestName,
                        status: req.status,
                        createdAt: req.createdAt
                    }))
                }
            })
        }

        // Barcha so'rovlarni tekshirish (agar birorta ham so'rov bo'lsa)
        const totalRequests = await Request.countDocuments({ userId: user._id })

        if (totalRequests > 0) {
            return res.status(400).json({
                msg: "Foydalanuvchini usta qilish mumkin emas",
                reason: "Foydalanuvchining so'rovlar tarixi mavjud",
                details: {
                    totalRequestsCount: totalRequests,
                    message: "Faqat yangi foydalanuvchilarni usta qilish mumkin"
                }
            })
        }

        // Foydalanuvchining takliflarini tekshirish (agar u boshqa ustalarga taklif yuborgan bo'lsa)
        const sentMails = await Mail.countDocuments({
            requestId: { $in: await Request.find({ userId: user._id }).distinct('_id') }
        })

        if (sentMails > 0) {
            return res.status(400).json({
                msg: "Foydalanuvchini usta qilish mumkin emas",
                reason: "Foydalanuvchi so'rovlariga takliflar kelgan",
                details: {
                    receivedOffersCount: sentMails
                }
            })
        }

        // Agar barcha tekshiruvlar muvaffaqiyatli bo'lsa, usta qilish
        const updatedUser = await User.findByIdAndUpdate(userId, { role: "usta" }, { new: true, select: "-password" })

        res.json({
            msg: 'Foydalanuvchi roli "usta" ga o\'zgartirildi',
            user: updatedUser,
        })
    } catch (err) {
        console.error("Make usta error:", err)
        res.status(500).json({ msg: "Rolni o'zgartirishda xatolik yuz berdi" })
    }
}

// Foydalanuvchini va unga tegishli barcha ma'lumotlarni o'chirish
exports.deleteUser = async (req, res) => {
    const { userId } = req.params

    try {
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ msg: "Foydalanuvchi topilmadi" })
        }

        // Prevent deleting admin users
        if (user.role === "admin") {
            return res.status(400).json({ msg: "Admin foydalanuvchisini o'chirib bo'lmaydi" })
        }

        // Start transaction-like operations
        try {
            // 1. Foydalanuvchining barcha so'rovlari va ularning IDlarini olish
            const userRequests = await Request.find({ userId: user._id })
            const requestIds = userRequests.map((req) => req._id)

            // 2. Ushbu so'rovlarga tegishli barcha takliflarni o'chirish
            if (requestIds.length > 0) {
                await Mail.deleteMany({ requestId: { $in: requestIds } })
            }

            // 3. Ushbu foydalanuvchi tomonidan yuborilgan takliflarni o'chirish (usta bo'lsa)
            await Mail.deleteMany({ ustaId: user._id })

            // 4. Foydalanuvchiga tegishli barcha fikrlarni o'chirish
            await Feedback.deleteMany({ userId: user._id })

            // 5. Usta bo'lsa, u haqidagi barcha fikrlarni ham o'chirish
            if (user.role === "usta") {
                await Feedback.deleteMany({ ustaId: user._id })
            }

            // 6. So'rovlarni o'chirish
            if (requestIds.length > 0) {
                await Request.deleteMany({ userId: user._id })
            }

            // 7. Foydalanuvchining o'zini o'chirish
            await User.findByIdAndDelete(user._id)

            res.json({
                msg: "Foydalanuvchi va unga tegishli barcha ma'lumotlar o'chirildi",
                deletedUser: {
                    id: user._id,
                    fullname: user.fullname,
                    email: user.email,
                    role: user.role,
                },
            })
        } catch (deleteError) {
            console.error("Delete operation error:", deleteError)
            throw deleteError
        }
    } catch (err) {
        console.error("Delete user error:", err)
        res.status(500).json({ msg: "Foydalanuvchini o'chirishda xatolik yuz berdi" })
    }
}

