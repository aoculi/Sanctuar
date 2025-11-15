import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, type ApiError } from "@/entrypoints/lib/api";
import { authStore } from "@/entrypoints/store/auth";

export type RegisterInput = {
  login: string;
  password: string;
};

export type RegisterResponse = {
  user_id: string;
  kdf: {
    algo: string;
    salt: string;
    m: number;
    t: number;
    p: number;
    hkdf_salt?: string | null;
  };
};

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation<RegisterResponse, ApiError, RegisterInput>({
    mutationKey: ["auth", "register"],
    mutationFn: async (input: RegisterInput) => {
      const response = await apiClient<RegisterResponse>("/auth/register", {
        method: "POST",
        body: input,
      });
      return response.data;
    },
    onSuccess: async (data) => {
      // Store KDF parameters for later use during unlock
      authStore.setKdf(data.kdf);
      authStore.setWrappedMk(null); // New users don't have WMK yet
    },
  });
}
