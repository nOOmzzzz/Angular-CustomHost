// json-server.js
import jsonServer from 'json-server';
const server = jsonServer.create();
const router = jsonServer.router('src/server/db.json');
const middlewares = jsonServer.defaults();
const port = 3000;

const routes= {
  "/api/v1/*": "/$1"
}

server.use(middlewares);

server.use(jsonServer.bodyParser);

server.use(jsonServer.rewriter(routes));



/**
 * @middleware Hotel Filter Middleware
 * @description Automatically filters resources by hotelId for multi-tenancy support
 * @header {string} X-Hotel-Id - ID of the hotel to filter data by (required)
 * @affects The following resources: users, rooms, bookings, iot-devices, service-requests, staff-requests, preferences
 * @behavior Only affects GET requests and complete listings (not individual resources)
 * @example
 * // Request:
 * // GET /rooms
 * // Headers: { "X-Hotel-Id": "1" }
 * //
 * // Internally equivalent to:
 * // GET /rooms?hotelId=1 -> But protected.
 */

server.use((req, res, next) => {
  if (req.method === 'GET') {
    // Obtener el hotelId del header de la petición
    const hotelId = req.headers['x-hotel-id'];

    if (hotelId) {

      const hotelResources = [
        'users', 'rooms', 'bookings', 'iot-devices',
        'service-requests', 'staff-requests', 'preferences'
      ];

      const urlParts = req.path.split('/');
      const resource = urlParts[1]; // Example: /rooms/1 -> rooms

      if (hotelResources.includes(resource) && !urlParts[2]) {
        req.query.hotelId = hotelId;
        console.log(`Aplicando filtro hotelId=${hotelId} para ${resource}`);
      }
    }
  }
  next();
});



/**
 * @endpoint POST /login
 * @description Authenticates a user and returns their data including hotelId
 * @body {string} email - User's email address
 * @body {string} password - User's password
 * @response {200} - Successful login with user data
 * @response {401} - Invalid credentials
 * @example
 * // Request:
 * // POST /login
 * // Body: { "email": "carlos.rodriguez@hotel.com", "password": "password123" }
 * //
 * // Successful response:
 * // {
 * //   "success": true,
 * //   "user": {
 * //     "id": 3,
 * //     "hotelId": 1,
 * //     "firstName": "Carlos",
 * //     "lastName": "Rodríguez",
 * //     "role": "admin"
 * //   }
 * // }
 */
server.post('/login', (req, res) => {
  const { email, password } = req.body;
  const db = router.db;
  const user = db.get('users').find({ email }).value();

  if (user && user.password === password) {
    res.json({
      success: true,
      user: {
        id: user.id,
        hotelId: user.hotelId,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } else {
    res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }
});

/***
 * @endpoint GET /rooms/available
 * @description Gets rooms available for a specific date range
 * @query {string} checkIn - Check-in date (ISO format)
 * @query {string} checkOut - Check-out date (ISO format)
 * @response {200} - List of available rooms
 * @response {400} - Error if dates are missing, invalid format or incorrect
 * @response {500} - Internal server error
 */
server.get('/rooms/available', (req, res) => {
  const { checkIn, checkOut } = req.query;

  if (!checkIn || !checkOut) {
    return res.status(400).json({ error: 'Se requieren fechas de check-in y check-out' });
  }

  try {
    const db = router.db;
    const rooms = db.get('rooms').value();
    const bookings = db.get('bookings').value();

    // Filtrar habitaciones ocupadas en ese rango de fechas
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate) || isNaN(checkOutDate)) {
      return res.status(400).json({ error: 'Formato de fecha inválido' });
    }

    if (checkInDate >= checkOutDate) {
      return res.status(400).json({ error: 'La fecha de check-out debe ser posterior al check-in' });
    }

    const bookedRoomIds = bookings
      .filter(b => {
        const bookingCheckIn = new Date(b.checkInDate);
        const bookingCheckOut = new Date(b.checkOutDate);
        return (
          (bookingCheckIn < checkOutDate && bookingCheckOut > checkInDate) &&
          (b.status === 'active' || b.status === 'confirmed')
        );
      })
      .map(b => b.roomId);

    // Filtrar habitaciones disponibles
    const availableRooms = rooms.filter(room =>
      !bookedRoomIds.includes(room.id) && room.status === 'available'
    );

    res.json(availableRooms);
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar la solicitud', details: error.message });
  }
});

/***
 * @endpoint POST /bookings/create
 * @description Creates a new room booking with validations
 * @body {number} userId - ID of the user making the booking
 * @body {number} roomId - ID of the room to book
 * @body {string} checkInDate - Check-in date (ISO format)
 * @body {string} checkOutDate - Check-out date (ISO format)
 * @body {string} specialRequests - Special requests (optional)
 * @response {201} - Booking successfully created
 * @response {400} - Error if required data is missing or room is unavailable
 * @response {404} - Error if room does not exist
 * @response {409} - Error if there is an overlap with another booking
 * @response {500} - Internal server error
 */
server.post('/bookings/create', (req, res) => {
  const { userId, roomId, checkInDate, checkOutDate, specialRequests } = req.body;

  if (!userId || !roomId || !checkInDate || !checkOutDate) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para la reserva' });
  }

  try {
    const db = router.db;
    const room = db.get('rooms').find({ id: parseInt(roomId) }).value();

    if (!room) {
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }

    if (room.status !== 'available') {
      return res.status(400).json({ error: 'La habitación no está disponible' });
    }

    const requestCheckIn = new Date(checkInDate);
    const requestCheckOut = new Date(checkOutDate);

    const existingBookings = db.get('bookings')
      .filter(booking =>
        booking.roomId === parseInt(roomId) &&
        (booking.status === 'active' || booking.status === 'confirmed')
      )
      .value();

    const hasOverlap = existingBookings.some(booking => {
      const bookingCheckIn = new Date(booking.checkInDate);
      const bookingCheckOut = new Date(booking.checkOutDate);

      return (requestCheckIn < bookingCheckOut && requestCheckOut > bookingCheckIn);
    });

    if (hasOverlap) {
      return res.status(409).json({
        error: 'La habitación ya está reservada en ese intervalo de fechas'
      });
    }

    const days = Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
    const dailyRate = room.type === 'suite' ? 150 : 100;
    const totalPrice = dailyRate * days;

    const newBooking = {
      id: Date.now(),
      userId: parseInt(userId),
      roomId: parseInt(roomId),
      checkInDate,
      checkOutDate,
      status: 'confirmed',
      totalPrice,
      paymentStatus: 'pending',
      specialRequests: specialRequests || '',
      createdAt: new Date().toISOString()
    };

    db.get('bookings').push(newBooking).write();

    res.status(201).json({
      success: true,
      message: 'Reserva creada correctamente',
      booking: newBooking
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar la reserva', details: error.message });
  }
});

/***
 * @endpoint PATCH /service-requests/:id/complete
 * @description Marks a service request as completed
 * @param {number} id - ID of the request to complete
 * @body {number} staffId - ID of the staff who completed the request
 * @body {string} notes - Completion notes (optional)
 * @response {200} - Request marked as completed
 * @response {400} - Error if staffId is missing or request is already completed
 * @response {404} - Error if request does not exist
 * @response {500} - Internal server error
 */
server.patch('/service-requests/:id/complete', (req, res) => {
  const { staffId, notes } = req.body;
  const requestId = parseInt(req.params.id);

  if (!staffId) {
    return res.status(400).json({ error: 'Se requiere ID del personal que completó la solicitud' });
  }

  try {
    const db = router.db;
    const request = db.get('service-requests').find({ id: requestId }).value();

    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (request.status === 'completed') {
      return res.status(400).json({ error: 'Esta solicitud ya está completada' });
    }

    // Actualizar solicitud
    db.get('service-requests')
      .find({ id: requestId })
      .assign({
        status: 'completed',
        assignedStaffId: parseInt(staffId),
        completedAt: new Date().toISOString(),
        completionNotes: notes || ''
      })
      .write();

    const newNotification = {
      id: Date.now(),
      recipientId: request.userId,
      title: 'Solicitud completada',
      message: `Su solicitud de "${request.requestType}" ha sido completada.`,
      status: 'unread',
      createdAt: new Date().toISOString()
    };

    db.get('notifications').push(newNotification).write();

    res.json({
      success: true,
      message: 'Solicitud marcada como completada',
      notificationSent: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al completar la solicitud', details: error.message });
  }
});




/***
 * @endpoint PATCH /staff-requests/:id/complete
 * @description Marks a staff request as completed
 * @param {number} id - ID of the staff request
 * @body {string} notes - Completion notes (optional)
 * @response {200} - Staff request marked as completed
 * @response {400} - Error if staff request is already completed
 * @response {404} - Error if staff request not found
 * @response {500} - Internal server error
 */
server.patch('/staff-requests/:id/complete', (req, res) => {
  const staffRequestId = parseInt(req.params.id);
  const { notes } = req.body;

  try {
    const db = router.db;
    const staffRequest = db.get('staff-requests').find({ id: staffRequestId }).value();

    if (!staffRequest) {
      return res.status(404).json({ error: 'Staff request not found' });
    }

    if (staffRequest.status === 'completed') {
      return res.status(400).json({ error: 'Staff request already completed' });
    }

    // Update staff request
    const updatedStaffRequest = {
      ...staffRequest,
      status: 'completed',
      completedAt: new Date().toISOString(),
      notes: notes ? staffRequest.notes + '\n' + notes : staffRequest.notes
    };

    db.get('staff-requests')
      .find({ id: staffRequestId })
      .assign(updatedStaffRequest)
      .write();

    // Create a system message for the guest
    const serviceRequest = db.get('service-requests')
      .find({ id: staffRequest.serviceRequestId })
      .value();

    res.json({
      success: true,
      message: 'Staff request marked as completed',
      staffRequest: updatedStaffRequest
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error completing staff request',
      details: error.message
    });
  }
});


/***
 * @endpoint POST /staff-requests/:id/create
 * @description Creates a staff request and automatically assigns it to the staff member who creates it
 * @param {number} id - ID of the service request to link
 * @body {number} staffId - ID of the staff member creating and handling the request
 * @body {string} title - Title for the staff request
 * @body {string} description - Description of the request
 * @body {string} priority - Priority level (high, normal, low)
 * @body {string} notes - Additional notes (optional)
 * @response {201} - Staff request created and assigned successfully
 * @response {400} - Error if required parameters are missing
 * @response {404} - Error if service request not found
 * @response {500} - Internal server error
 */
server.post('/staff-requests/:id/create', (req, res) => {
  const serviceRequestId = parseInt(req.params.id);
  const { staffId, title, description, priority, notes } = req.body;

  if (!staffId || !title || !description || !priority) {
    return res.status(400).json({ error: 'Missing required fields (staffId, title, description, priority)' });
  }

  try {
    const db = router.db;
    const serviceRequest = db.get('service-requests').find({ id: serviceRequestId }).value();

    if (!serviceRequest) {
      return res.status(404).json({ error: 'Service request not found' });
    }

    const newStaffRequest = {
      id: Date.now(),
      serviceRequestId: serviceRequestId,
      title,
      description,
      status: 'assigned',
      priority,
      createdAt: new Date().toISOString(),
      handledByStaffId: parseInt(staffId),
      assignedAt: new Date().toISOString(),
      completedAt: null,
      notes: notes || ''
    };

    db.get('staff-requests').push(newStaffRequest).write();

    // Update related service request
    db.get('service-requests')
      .find({ id: serviceRequestId })
      .assign({
        status: 'in-progress',
        assignedStaffId: parseInt(staffId)
      })
      .write();

    res.status(201).json({
      success: true,
      message: 'Staff request created and assigned successfully',
      staffRequest: newStaffRequest
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error creating staff request',
      details: error.message
    });
  }
});





/***
 * @endpoint POST /apply-guest-preferences
 * @description Applies guest preferences to the IoT devices in a room
 * @body {number} guestId - ID of the guest
 * @body {number} roomId - ID of the room
 * @response {200} - Preferences successfully applied
 * @response {400} - Error if guestId or roomId is missing
 * @response {404} - Error if guest doesn't exist or no devices in the room
 * @response {500} - Internal server error
 */
server.post('/apply-guest-preferences', (req, res) => {
  const db = router.db;
  const { guestId, roomId } = req.body;

  if (!guestId || !roomId) {
    return res.status(400).json({ error: 'Se requiere guestId y roomId' });
  }

  try {
    const guest = db.get('users').find({ id: parseInt(guestId) }).value();
    const devices = db.get('iot-devices').filter({ roomId: parseInt(roomId) }).value();

    if (!guest) {
      return res.status(404).json({ error: 'Huésped no encontrado' });
    }

    if (devices.length === 0) {
      return res.status(404).json({ error: 'No hay dispositivos en esa habitación' });
    }

    // Aplicar preferencias a los dispositivos
    const updatedDevices = devices.map(device => {
      const updatedDevice = { ...device };

      // Aplicar preferencias según el tipo de dispositivo
      if (device.deviceType === 'thermostat' && guest.preferences?.temperature) {
        updatedDevice.currentState = {
          ...updatedDevice.currentState,
          temperature: guest.preferences.temperature
        };
      } else if (device.deviceType === 'light' && guest.preferences?.lighting) {
        updatedDevice.currentState = {
          ...updatedDevice.currentState,
          brightness: guest.preferences.lighting.brightness,
          color: guest.preferences.lighting.color,
          isOn: true
        };
      } else if (device.deviceType === 'curtains' && guest.preferences?.curtains) {
        updatedDevice.currentState = {
          ...updatedDevice.currentState,
          position: guest.preferences.curtains
        };
      } else if (device.deviceType === 'tv' && guest.preferences?.tvVolume) {
        updatedDevice.currentState = {
          ...updatedDevice.currentState,
          volume: guest.preferences.tvVolume
        };
      }

      updatedDevice.lastUpdated = new Date().toISOString();

      // Actualizar en la base de datos (corregido nombre de colección)
      db.get('iot-devices')
        .find({ id: device.id })
        .assign(updatedDevice)
        .write();

      return updatedDevice;
    });

    // Actualizar la habitación (corregido nombre de campo)
    db.get('rooms')
      .find({ id: parseInt(roomId) })
      .assign({
        status: 'occupied',
        currentUserId: parseInt(guestId)
      })
      .write();

    res.json({
      success: true,
      message: 'Preferencias aplicadas correctamente',
      devices: updatedDevices
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al aplicar preferencias',
      details: error.message
    });
  }
});

server.use(jsonServer.rewriter({

}));

server.use(router);

server.listen(port, () => {
  console.log(`JSON Server listening => http://localhost:${port}`);
});
