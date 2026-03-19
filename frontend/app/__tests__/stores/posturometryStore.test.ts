import Cookies from 'js-cookie';
import { usePosturometryStore } from '@/lib/stores/posturometryStore';
import { api } from '@/lib/services/http';

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('@/lib/services/http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

function resetStore() {
  usePosturometryStore.setState({
    evaluations: [],
    loading: false,
    submitting: false,
    error: '',
  });
}

const MOCK_EVALUATION = {
  id: 1,
  customer_id: 10,
  trainer_name: 'Germán Franco',
  evaluation_date: '2025-01-15',
  anterior_data: { head: { is_normal: true, severity: 0, sub_fields: {} } },
  lateral_right_data: {},
  lateral_left_data: {},
  posterior_data: {},
  anterior_photo: null,
  lateral_right_photo: null,
  lateral_left_photo: null,
  posterior_photo: null,
  anterior_observations: '',
  lateral_right_observations: '',
  lateral_left_observations: '',
  posterior_observations: '',
  notes: '',
  recommendations: {},
  global_index: '85.0',
  global_category: 'Bueno',
  global_color: 'green',
  upper_index: '90.0',
  upper_category: 'Excelente',
  upper_color: 'green',
  central_index: '80.0',
  central_category: 'Bueno',
  central_color: 'green',
  lower_index: '85.0',
  lower_category: 'Bueno',
  lower_color: 'green',
  segment_scores: {},
  findings: {},
  created_at: '2025-01-15T12:00:00Z',
};

const MOCK_FORM_DATA = {
  evaluation_date: '2025-01-15',
  anterior_data: { head: { is_normal: true, severity: 0, sub_fields: {} } },
  lateral_right_data: {},
  lateral_left_data: {},
  posterior_data: {},
  anterior_observations: '',
  lateral_right_observations: '',
  lateral_left_observations: '',
  posterior_observations: '',
  notes: '',
  anterior_photo: null,
  lateral_right_photo: null,
  lateral_left_photo: null,
  posterior_photo: null,
};

describe('posturometryStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetStore();
    (Cookies.get as jest.Mock).mockReturnValue('fake-token');
  });

  describe('fetchEvaluations', () => {
    it('populates evaluations on success', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_EVALUATION] });
      await usePosturometryStore.getState().fetchEvaluations(10);
      const state = usePosturometryStore.getState();
      expect(state.evaluations).toHaveLength(1);
      expect(state.evaluations[0].global_index).toBe('85.0');
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/10/posturometry/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await usePosturometryStore.getState().fetchEvaluations(10);
      expect(usePosturometryStore.getState().error).toBe('No se pudieron cargar las evaluaciones posturales.');
      expect(usePosturometryStore.getState().loading).toBe(false);
    });
  });

  describe('createEvaluation', () => {
    it('prepends new evaluation to list on success', async () => {
      usePosturometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      const newEval = { ...MOCK_EVALUATION, id: 2 };
      mockedApi.post.mockResolvedValueOnce({ data: newEval });
      const result = await usePosturometryStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      const state = usePosturometryStore.getState();
      expect(result).toEqual(newEval);
      expect(state.evaluations).toHaveLength(2);
      expect(state.evaluations[0].id).toBe(2);
      expect(state.submitting).toBe(false);
    });

    it('sends FormData with multipart content type', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      await usePosturometryStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/trainer/my-clients/10/posturometry/',
        expect.any(FormData),
        { headers: { Authorization: 'Bearer fake-token', 'Content-Type': 'multipart/form-data' } },
      );
    });

    it('returns null and sets error on failure', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Network'));
      const result = await usePosturometryStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(usePosturometryStore.getState().error).toBe('No se pudo guardar la evaluación postural.');
      expect(usePosturometryStore.getState().submitting).toBe(false);
    });

    it('extracts detail from error response', async () => {
      mockedApi.post.mockRejectedValueOnce({ response: { data: { detail: 'Validation failed.' } } });
      const result = await usePosturometryStore.getState().createEvaluation(10, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(usePosturometryStore.getState().error).toBe('Validation failed.');
    });
  });

  describe('updateEvaluation', () => {
    it('updates evaluation in list on success', async () => {
      usePosturometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      const updated = { ...MOCK_EVALUATION, notes: 'Updated' };
      mockedApi.patch.mockResolvedValueOnce({ data: updated });
      const result = await usePosturometryStore.getState().updateEvaluation(10, 1, { notes: 'Updated' });
      expect(result).toEqual(updated);
      expect(usePosturometryStore.getState().evaluations[0].notes).toBe('Updated');
      expect(usePosturometryStore.getState().submitting).toBe(false);
    });

    it('sets error on failure', async () => {
      mockedApi.patch.mockRejectedValueOnce(new Error('Network'));
      const result = await usePosturometryStore.getState().updateEvaluation(10, 1, { notes: 'x' });
      expect(result).toBeNull();
      expect(usePosturometryStore.getState().error).toBe('No se pudieron guardar las recomendaciones.');
    });
  });

  describe('fullUpdateEvaluation', () => {
    it('replaces evaluation in list on success', async () => {
      usePosturometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      const updated = { ...MOCK_EVALUATION, global_index: '90.0' };
      mockedApi.put.mockResolvedValueOnce({ data: updated });
      const result = await usePosturometryStore.getState().fullUpdateEvaluation(10, 1, MOCK_FORM_DATA);
      expect(result).toEqual(updated);
      expect(usePosturometryStore.getState().evaluations[0].global_index).toBe('90.0');
      expect(usePosturometryStore.getState().submitting).toBe(false);
    });

    it('sends FormData with multipart content type', async () => {
      mockedApi.put.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      await usePosturometryStore.getState().fullUpdateEvaluation(10, 1, MOCK_FORM_DATA);
      expect(mockedApi.put).toHaveBeenCalledWith(
        '/trainer/my-clients/10/posturometry/1/',
        expect.any(FormData),
        { headers: { Authorization: 'Bearer fake-token', 'Content-Type': 'multipart/form-data' } },
      );
    });

    it('returns null and sets error on failure', async () => {
      mockedApi.put.mockRejectedValueOnce(new Error('Network'));
      const result = await usePosturometryStore.getState().fullUpdateEvaluation(10, 1, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(usePosturometryStore.getState().error).toBe('No se pudo actualizar la evaluación postural.');
    });

    it('extracts detail from error response', async () => {
      mockedApi.put.mockRejectedValueOnce({ response: { data: { detail: 'Bad data.' } } });
      const result = await usePosturometryStore.getState().fullUpdateEvaluation(10, 1, MOCK_FORM_DATA);
      expect(result).toBeNull();
      expect(usePosturometryStore.getState().error).toBe('Bad data.');
    });
  });

  describe('deleteEvaluation', () => {
    it('removes evaluation from list on success', async () => {
      usePosturometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      mockedApi.delete.mockResolvedValueOnce({});
      const result = await usePosturometryStore.getState().deleteEvaluation(10, 1);
      expect(result).toBe(true);
      expect(usePosturometryStore.getState().evaluations).toHaveLength(0);
      expect(usePosturometryStore.getState().submitting).toBe(false);
    });

    it('sets error on failure', async () => {
      mockedApi.delete.mockRejectedValueOnce(new Error('Network'));
      const result = await usePosturometryStore.getState().deleteEvaluation(10, 1);
      expect(result).toBe(false);
      expect(usePosturometryStore.getState().error).toBe('No se pudo eliminar la evaluación.');
    });
  });

  describe('authHeaders branch - no token', () => {
    it('sends empty headers when no token cookie exists', async () => {
      (Cookies.get as jest.Mock).mockReturnValue(undefined);
      mockedApi.get.mockResolvedValueOnce({ data: [] });
      await usePosturometryStore.getState().fetchEvaluations(10);
      expect(mockedApi.get).toHaveBeenCalledWith('/trainer/my-clients/10/posturometry/', {
        headers: {},
      });
    });
  });

  describe('createEvaluation - photo append branches', () => {
    it('appends photo files to FormData when provided', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const fakeFile = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
      const formWithPhotos = {
        ...MOCK_FORM_DATA,
        anterior_photo: fakeFile,
        lateral_right_photo: fakeFile,
        lateral_left_photo: fakeFile,
        posterior_photo: fakeFile,
      };
      await usePosturometryStore.getState().createEvaluation(10, formWithPhotos);
      const fd = mockedApi.post.mock.calls[0][1] as FormData;
      expect(fd.get('anterior_photo')).toBeTruthy();
      expect(fd.get('lateral_right_photo')).toBeTruthy();
      expect(fd.get('lateral_left_photo')).toBeTruthy();
      expect(fd.get('posterior_photo')).toBeTruthy();
    });

    it('skips evaluation_date in FormData when empty', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const formNoDate = { ...MOCK_FORM_DATA, evaluation_date: '' };
      await usePosturometryStore.getState().createEvaluation(10, formNoDate);
      const fd = mockedApi.post.mock.calls[0][1] as FormData;
      expect(fd.get('evaluation_date')).toBeNull();
    });
  });

  describe('fullUpdateEvaluation - photo append branches', () => {
    it('appends photo files to FormData when provided', async () => {
      usePosturometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      mockedApi.put.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const fakeFile = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
      const formWithPhotos = {
        ...MOCK_FORM_DATA,
        anterior_photo: fakeFile,
        lateral_right_photo: fakeFile,
        lateral_left_photo: fakeFile,
        posterior_photo: fakeFile,
      };
      await usePosturometryStore.getState().fullUpdateEvaluation(10, 1, formWithPhotos);
      const fd = mockedApi.put.mock.calls[0][1] as FormData;
      expect(fd.get('anterior_photo')).toBeTruthy();
      expect(fd.get('lateral_right_photo')).toBeTruthy();
      expect(fd.get('lateral_left_photo')).toBeTruthy();
      expect(fd.get('posterior_photo')).toBeTruthy();
    });

    it('skips evaluation_date in fullUpdate FormData when empty', async () => {
      usePosturometryStore.setState({ evaluations: [MOCK_EVALUATION] });
      mockedApi.put.mockResolvedValueOnce({ data: MOCK_EVALUATION });
      const formNoDate = { ...MOCK_FORM_DATA, evaluation_date: '' };
      await usePosturometryStore.getState().fullUpdateEvaluation(10, 1, formNoDate);
      const fd = mockedApi.put.mock.calls[0][1] as FormData;
      expect(fd.get('evaluation_date')).toBeNull();
    });

    it('preserves non-matching evaluations in map callback', async () => {
      const other = { ...MOCK_EVALUATION, id: 99 };
      usePosturometryStore.setState({ evaluations: [MOCK_EVALUATION, other] });
      const updated = { ...MOCK_EVALUATION, global_index: '95.0' };
      mockedApi.put.mockResolvedValueOnce({ data: updated });
      await usePosturometryStore.getState().fullUpdateEvaluation(10, 1, MOCK_FORM_DATA);
      const state = usePosturometryStore.getState();
      expect(state.evaluations).toHaveLength(2);
      expect(state.evaluations[0].global_index).toBe('95.0');
      expect(state.evaluations[1].id).toBe(99);
    });
  });

  describe('updateEvaluation - map branch for non-matching id', () => {
    it('preserves other evaluations when updating by id', async () => {
      const other = { ...MOCK_EVALUATION, id: 99 };
      usePosturometryStore.setState({ evaluations: [MOCK_EVALUATION, other] });
      const updated = { ...MOCK_EVALUATION, notes: 'Changed' };
      mockedApi.patch.mockResolvedValueOnce({ data: updated });
      await usePosturometryStore.getState().updateEvaluation(10, 1, { notes: 'Changed' });
      const state = usePosturometryStore.getState();
      expect(state.evaluations).toHaveLength(2);
      expect(state.evaluations[0].notes).toBe('Changed');
      expect(state.evaluations[1].id).toBe(99);
    });
  });

  describe('fetchMyEvaluations', () => {
    it('populates evaluations from customer endpoint', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [MOCK_EVALUATION] });
      await usePosturometryStore.getState().fetchMyEvaluations();
      const state = usePosturometryStore.getState();
      expect(state.evaluations).toHaveLength(1);
      expect(state.loading).toBe(false);
      expect(mockedApi.get).toHaveBeenCalledWith('/my-posturometry/', {
        headers: { Authorization: 'Bearer fake-token' },
      });
    });

    it('sets error on failure', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));
      await usePosturometryStore.getState().fetchMyEvaluations();
      expect(usePosturometryStore.getState().error).toBe('No se pudieron cargar tus evaluaciones posturales.');
      expect(usePosturometryStore.getState().loading).toBe(false);
    });
  });
});
